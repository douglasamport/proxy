import { sql } from "@/db/client";
import { CFG, chassisFromEffects } from "./mining-engine";
import type { Chassis, StatKey } from "./mining-engine";

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
}

export interface InventoryRow {
  item_key: string;
  owned_quantity: number;
  equipped_quantity: number;
}

export async function loadCatalog(game: string): Promise<CatalogItem[]> {
  const rows = await sql`
    select item_key, game, category, label, description, cost, effects, active, image_url
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

export type SetEquippedResult = "ok" | "not_owned" | "over_cap";

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
    select owned_quantity from player_inventory where player_id = ${playerId} and item_key = ${itemKey}
  `;
  if (!row || quantity < 0 || quantity > row.owned_quantity) return "not_owned";

  const [{ total }] = await sql`
    select coalesce(sum(equipped_quantity), 0)::int as total
    from player_inventory
    where player_id = ${playerId} and item_key != ${itemKey}
  `;
  const slotTotal = await getSlotTotal(playerId);
  if (total + quantity > slotTotal) return "over_cap";

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
export async function purchaseChassisExpansion(playerId: string, game: string): Promise<PurchaseItemResult> {
  const [item] = await sql`select cost from item_catalog where item_key = ${EXPANSION_ITEM_KEY} and game = ${game} and active = true`;
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
