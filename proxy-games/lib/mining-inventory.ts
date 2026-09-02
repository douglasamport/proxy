import { sql } from "@/db/client";
import { CFG, chassisFromEffects } from "./mining-engine";
import type { Chassis, OreTypeKey, StatKey } from "./mining-engine";

export interface CatalogItem {
  item_key: string;
  game: string;
  category: string;
  label: string;
  description: string | null;
  cost: string;
  effects: Partial<Record<StatKey, number>>;
  active: boolean;
  image_url: string | null;
  sellable: boolean;
  // Ore: a flat credit price. Everything else: a ratio of `cost` (0.5 =
  // sells back at 50%) — see db/011_sell_prices.sql. Null when !sellable.
  sell_value: string | null;
}

export interface InventoryRow {
  item_key: string;
  owned_quantity: number;
  equipped_quantity: number;
}

export async function loadCatalog(game: string): Promise<CatalogItem[]> {
  const rows = await sql`
    select item_key, game, category, label, description, cost, effects, active, image_url, sellable, sell_value
    from item_catalog
    where game = ${game} and active = true
    order by category, cost
  `;
  return rows as CatalogItem[];
}

export async function loadInventory(playerId: string): Promise<InventoryRow[]> {
  const rows = await sql`
    select item_key, owned_quantity, equipped_quantity
    from player_inventory
    where player_id = ${playerId}
  `;
  return rows as InventoryRow[];
}

export type PurchaseItemResult =
  | { kind: "ok"; balance: string }
  | { kind: "insufficient_funds" }
  | { kind: "not_found" };

// Same shape as purchaseSurvey() in mining-run-store.ts: atomic conditional
// deduct first (so a race can't double-spend), then the inventory update +
// ledger row as a batch. If the item doesn't exist/isn't active, nothing is
// charged at all — the catalog lookup happens before any money moves.
export async function purchaseItem(
  playerId: string,
  game: string,
  itemKey: string,
  quantity: number,
): Promise<PurchaseItemResult> {
  const [item] =
    await sql`select cost from item_catalog where item_key = ${itemKey} and game = ${game} and active = true`;
  if (!item) return { kind: "not_found" };

  const totalCost = Number(item.cost) * quantity;
  const [deducted] = await sql`
    update players set balance = balance - ${totalCost}
    where id = ${playerId} and balance >= ${totalCost}
    returning balance
  `;
  if (!deducted) return { kind: "insufficient_funds" };

  await sql.transaction([
    sql`
      insert into player_inventory (player_id, item_key, owned_quantity)
      values (${playerId}, ${itemKey}, ${quantity})
      on conflict (player_id, item_key)
      do update set owned_quantity = player_inventory.owned_quantity + excluded.owned_quantity, updated_at = now()
    `,
    sql`
      insert into balance_transactions (player_id, game, reason, delta)
      values (${playerId}, ${game}, 'store_purchase', ${-totalCost})
    `,
  ]);

  return { kind: "ok", balance: deducted.balance };
}

export type SellItemResult =
  | { kind: "ok"; balance: string }
  | { kind: "not_found" }
  | { kind: "not_sellable" }
  | { kind: "insufficient_owned" };

// Mirrors purchaseItem()'s shape in reverse: credit first (atomic, so a
// race can't double-sell past what's actually available), then the
// inventory/ledger update as a batch. Only unequipped copies can be sold —
// owned_quantity drops, equipped_quantity is untouched, so selling never
// silently unequips something still fitted (sell the copies you're not
// using, or unequip first). Ore's sell_value is a flat credit price;
// everything else's is a ratio of that row's own cost — see
// db/011_sell_prices.sql and the CatalogItem comment above.
export async function sellItem(
  playerId: string,
  game: string,
  itemKey: string,
  quantity: number,
): Promise<SellItemResult> {
  const [row] = await sql`
    select ic.cost, ic.sellable, ic.sell_value, ic.category,
           coalesce(pi.owned_quantity, 0) as owned_quantity,
           coalesce(pi.equipped_quantity, 0) as equipped_quantity
    from item_catalog ic
    left join player_inventory pi on pi.item_key = ic.item_key and pi.player_id = ${playerId}
    where ic.item_key = ${itemKey} and ic.game = ${game} and ic.active = true
  `;
  if (!row) return { kind: "not_found" };
  if (!row.sellable || row.sell_value == null) return { kind: "not_sellable" };

  const available = row.owned_quantity - row.equipped_quantity;
  if (quantity > available) return { kind: "insufficient_owned" };

  const unitPrice =
    row.category === ORE_CATEGORY
      ? Number(row.sell_value)
      : Number(row.cost) * Number(row.sell_value);
  const proceeds = unitPrice * quantity;

  await sql.transaction([
    sql`
      update player_inventory set owned_quantity = owned_quantity - ${quantity}, updated_at = now()
      where player_id = ${playerId} and item_key = ${itemKey}
    `,
    sql`
      insert into balance_transactions (player_id, game, reason, delta)
      values (${playerId}, ${game}, 'item_sale', ${proceeds})
    `,
    sql`update players set balance = balance + ${proceeds} where id = ${playerId}`,
  ]);

  const [{ balance }] =
    await sql`select balance from players where id = ${playerId}`;
  return { kind: "ok", balance };
}

export type SetEquippedResult = "ok" | "not_owned" | "over_cap";

// Equipment items (ore siphon, line scanner) draw against a completely
// separate slot pool from chassis gear — see getEquipmentSlotTotal() below
// — so they don't compete with fuel tanks and armor plate for the same 10
// (+expansions) slots.
export const EQUIPMENT_CATEGORY = "equipment";

// Mined ore, stockpiled at run-end instead of collected as credits (see
// settleRun in mining-run-store.ts). Never equippable, unlimited quantity —
// same non-equip shape as EXPANSION_ITEM_KEY below, just one row per ore
// type instead of a single row.
export const ORE_CATEGORY = "ore";

// One-time per-mineral unlocks (see db/013_mineral_licences.sql and the
// db/014 rename) — same one-time-gate shape as EQUIPMENT_SLOT_KEY below,
// just twelve rows instead of one. Bought via the ordinary purchaseItem()
// flow; the store UI (not a dedicated endpoint) is what stops a player from
// buying a second one. Item keys are 'license_<ore>'.
export const LICENSE_CATEGORY = "license";

// Every mineral eligible for field generation for this player — copper is
// always included, since it's unlocked from the start and never gated by a
// license (see Stage 5 of build-spec-ore-progression.md). Consumed by
// Stage 6's field generation.
export async function loadUnlockedOreTypes(
  playerId: string,
): Promise<OreTypeKey[]> {
  const rows = await sql`
    select pi.item_key from player_inventory pi
    join item_catalog ic on ic.item_key = pi.item_key
    where pi.player_id = ${playerId} and ic.category = ${LICENSE_CATEGORY} and pi.owned_quantity > 0
  `;
  return [
    "copper",
    ...rows.map(
      (r) => (r.item_key as string).replace(/^license_/, "") as OreTypeKey,
    ),
  ];
}

// Equipping/unequipping never touches the balance — the item's already
// paid for, this only decides what's currently installed. Not wrapped in
// the same race-proof machinery as purchaseItem: this is a player editing
// their own loadout, not a money movement, so a narrow race window between
// the ownership check and the slot-cap check is an acceptable tradeoff
// here (worst case, a concurrent double-click briefly exceeds the cap by
// one before the next read corrects it).
export async function setEquipped(
  playerId: string,
  itemKey: string,
  quantity: number,
): Promise<SetEquippedResult> {
  const [row] = await sql`
    select pi.owned_quantity, ic.category
    from player_inventory pi
    join item_catalog ic on ic.item_key = pi.item_key
    where pi.player_id = ${playerId} and pi.item_key = ${itemKey}
  `;
  if (!row || quantity < 0 || quantity > row.owned_quantity) return "not_owned";

  const isEquipment = row.category === EQUIPMENT_CATEGORY;
  const cap = isEquipment
    ? await getEquipmentSlotTotal(playerId)
    : await getSlotTotal(playerId);

  // Scoped to the same pool the item being changed belongs to — an
  // equipment item's count never competes with chassis gear, and vice versa.
  const [{ total }] = await sql`
    select coalesce(sum(pi.equipped_quantity), 0)::int as total
    from player_inventory pi
    join item_catalog ic on ic.item_key = pi.item_key
    where pi.player_id = ${playerId} and pi.item_key != ${itemKey}
      and (ic.category = ${EQUIPMENT_CATEGORY}) = ${isEquipment}
  `;
  if (total + quantity > cap) return "over_cap";

  await sql`
    update player_inventory set equipped_quantity = ${quantity}, updated_at = now()
    where player_id = ${playerId} and item_key = ${itemKey}
  `;
  return "ok";
}

// Not equippable like everything else — owning one permanently raises
// slot capacity by exactly 1, always in effect. Its equipped_quantity
// stays 0 forever (see purchaseChassisExpansion()) so it never counts
// against the very cap it's expanding.
export const EXPANSION_ITEM_KEY = "chassis_expansion";

export async function getSlotTotal(playerId: string): Promise<number> {
  const [row] = await sql`
    select owned_quantity from player_inventory
    where player_id = ${playerId} and item_key = ${EXPANSION_ITEM_KEY}
  `;
  return CFG.SLOT_TOTAL + (row?.owned_quantity ?? 0);
}

// Each expansion costs double the last one — the catalog's `cost` for
// chassis_expansion is just the base price (the first one); the doubling
// itself is the mechanic, not data, so it lives here rather than as a
// stored-per-purchase number. +1 slot capacity, always, no equip step.
export async function purchaseChassisExpansion(
  playerId: string,
  game: string,
): Promise<PurchaseItemResult> {
  const [item] =
    await sql`select cost from item_catalog where item_key = ${EXPANSION_ITEM_KEY} and game = ${game} and active = true`;
  if (!item) return { kind: "not_found" };

  const [owned] = await sql`
    select owned_quantity from player_inventory
    where player_id = ${playerId} and item_key = ${EXPANSION_ITEM_KEY}
  `;
  const level = owned?.owned_quantity ?? 0;
  const cost = Number(item.cost) * 2 ** level;

  const [deducted] = await sql`
    update players set balance = balance - ${cost}
    where id = ${playerId} and balance >= ${cost}
    returning balance
  `;
  if (!deducted) return { kind: "insufficient_funds" };

  await sql.transaction([
    sql`
      insert into player_inventory (player_id, item_key, owned_quantity, equipped_quantity)
      values (${playerId}, ${EXPANSION_ITEM_KEY}, 1, 0)
      on conflict (player_id, item_key)
      do update set owned_quantity = player_inventory.owned_quantity + 1, updated_at = now()
    `,
    sql`
      insert into balance_transactions (player_id, game, reason, delta)
      values (${playerId}, ${game}, 'chassis_expansion', ${-cost})
    `,
  ]);

  return { kind: "ok", balance: deducted.balance };
}

// A single, very expensive slot for single-use field tools (ore siphon,
// line scanner) — not a repeatable doubling purchase like chassis
// expansion. One slot, period; see purchaseEquipmentSlotUnlock().
export const EQUIPMENT_SLOT_KEY = "equipment_slot_unlock";

export async function getEquipmentSlotTotal(playerId: string): Promise<number> {
  const [row] = await sql`
    select owned_quantity from player_inventory
    where player_id = ${playerId} and item_key = ${EQUIPMENT_SLOT_KEY}
  `;
  return row?.owned_quantity ?? 0; // 0 until bought, capped at 1 below
}

export type PurchaseEquipmentSlotResult =
  | { kind: "ok"; balance: string }
  | { kind: "insufficient_funds" }
  | { kind: "not_found" }
  | { kind: "already_owned" };

export async function purchaseEquipmentSlotUnlock(
  playerId: string,
  game: string,
): Promise<PurchaseEquipmentSlotResult> {
  const [item] =
    await sql`select cost from item_catalog where item_key = ${EQUIPMENT_SLOT_KEY} and game = ${game} and active = true`;
  if (!item) return { kind: "not_found" };
  const cost = Number(item.cost);

  const [deducted] = await sql`
    update players set balance = balance - ${cost}
    where id = ${playerId} and balance >= ${cost}
    returning balance
  `;
  if (!deducted) return { kind: "insufficient_funds" };

  // "on conflict do nothing" makes the insert a race-proof one-time gate —
  // a row for this key can only ever mean "already owns the slot", so if
  // it already existed this returns nothing and the purchase is refunded,
  // the same way purchaseSurvey() refunds an orphaned conditional write.
  const results = await sql.transaction([
    sql`
      insert into player_inventory (player_id, item_key, owned_quantity, equipped_quantity)
      values (${playerId}, ${EQUIPMENT_SLOT_KEY}, 1, 0)
      on conflict (player_id, item_key) do nothing
      returning item_key
    `,
    sql`
      insert into balance_transactions (player_id, game, reason, delta)
      values (${playerId}, ${game}, 'equipment_slot_unlock', ${-cost})
    `,
  ]);

  const inserted = results[0] as { item_key: string }[];
  if (!inserted.length) {
    await sql`update players set balance = balance + ${cost} where id = ${playerId}`;
    return { kind: "already_owned" };
  }

  return { kind: "ok", balance: deducted.balance };
}

// Whether the player currently has a usable one of this equipped — checked
// live against player_inventory at the moment a run action tries to use
// it, not snapshotted at launch like the rest of the loadout, since the
// whole point is that it can run out mid-run.
export async function hasEquippedConsumable(
  playerId: string,
  itemKey: string,
): Promise<boolean> {
  const [row] = await sql`
    select equipped_quantity from player_inventory
    where player_id = ${playerId} and item_key = ${itemKey}
  `;
  return (row?.equipped_quantity ?? 0) > 0;
}

// Called only after the run-state mutation it enabled has already
// succeeded (err-free) — a rejected/no-op use shouldn't cost the item.
// Owned and equipped drop together: nothing is left "equipped" once the
// only copy is gone.
export async function consumeEquippedItem(
  playerId: string,
  itemKey: string,
): Promise<void> {
  await sql`
    update player_inventory
    set owned_quantity = owned_quantity - 1, equipped_quantity = equipped_quantity - 1, updated_at = now()
    where player_id = ${playerId} and item_key = ${itemKey} and equipped_quantity > 0
  `;
}

// Item keys currently equipped in the equipment slot(s) — what the client
// uses to decide which "use X" buttons to show during a run.
export async function loadEquipmentAvailable(
  playerId: string,
): Promise<string[]> {
  const rows = await sql`
    select pi.item_key from player_inventory pi
    join item_catalog ic on ic.item_key = pi.item_key
    where pi.player_id = ${playerId} and ic.category = ${EQUIPMENT_CATEGORY} and pi.equipped_quantity > 0
  `;
  return rows.map((r) => r.item_key as string);
}

// Every chassis has this much for free, before anything's equipped — one
// basic drive, one basic steer, one basic armor plate, three basic cargo
// units. Without it a totally bare chassis has 0 speed and 0 movement,
// which is a divide-by-zero in the fuel-cost math (1/speed), not just an
// undesirable default. Sourced from item_catalog itself (not hardcoded
// numbers) so a later balance change to these items' effects moves the
// floor too, instead of silently drifting out of sync with it.
const BASELINE_DRIVE = "drive_basic";
const BASELINE_STEER = "steer_basic";
const BASELINE_ARMOUR = "armour_basic";
const BASELINE_CARGO = "cargo_basic";
const BASELINE_CARGO_QTY = 1;

function addEffects(
  into: Partial<Record<StatKey, number>>,
  itemEffects: Partial<Record<StatKey, number>>,
  quantity: number,
) {
  for (const key of Object.keys(itemEffects) as StatKey[]) {
    const delta = itemEffects[key] ?? 0;
    into[key] = (into[key] ?? 0) + delta * quantity;
  }
}

// Sums the baseline plus equipped-item effects into a stat-delta map, then
// hands it to the pure chassisFromEffects() — this is the one place
// inventory (DB) and engine (pure functions) meet.
export async function computeEffects(
  playerId: string,
): Promise<Partial<Record<StatKey, number>>> {
  const [baselineRows, equippedRows] = await Promise.all([
    sql`
      select item_key, effects from item_catalog
      where item_key in (${BASELINE_DRIVE}, ${BASELINE_STEER}, ${BASELINE_ARMOUR}, ${BASELINE_CARGO})
    `,
    sql`
      select ic.effects, pi.equipped_quantity
      from player_inventory pi
      join item_catalog ic on ic.item_key = pi.item_key
      where pi.player_id = ${playerId} and pi.equipped_quantity > 0
    `,
  ]);

  const effects: Partial<Record<StatKey, number>> = {};

  const baselineByKey = new Map(
    baselineRows.map((r) => [
      r.item_key as string,
      r.effects as Partial<Record<StatKey, number>>,
    ]),
  );
  const applyBaseline = (itemKey: string, quantity: number) => {
    const itemEffects = baselineByKey.get(itemKey);
    if (itemEffects) addEffects(effects, itemEffects, quantity);
  };
  applyBaseline(BASELINE_DRIVE, 1);
  applyBaseline(BASELINE_STEER, 1);
  applyBaseline(BASELINE_ARMOUR, 1);
  applyBaseline(BASELINE_CARGO, BASELINE_CARGO_QTY);

  for (const row of equippedRows) {
    addEffects(
      effects,
      row.effects as Partial<Record<StatKey, number>>,
      row.equipped_quantity,
    );
  }

  return effects;
}

export async function computeChassis(playerId: string): Promise<Chassis> {
  return chassisFromEffects(await computeEffects(playerId));
}

// Snapshot of what's actually equipped at launch time, for runs.config —
// replaces the old { alloc } shape.
export async function loadoutSnapshot(
  playerId: string,
): Promise<{ item_key: string; quantity: number }[]> {
  const rows = await sql`
    select item_key, equipped_quantity from player_inventory
    where player_id = ${playerId} and equipped_quantity > 0
  `;
  return rows.map((r) => ({
    item_key: r.item_key,
    quantity: r.equipped_quantity,
  }));
}
