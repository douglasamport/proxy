import { sql } from "@/db/client";
import { CFG, chassisFromEffects } from "./mining-engine";
import type { Chassis, StatKey } from "./mining-engine";
import { getOrCreateCharacter } from "./characters";
import {
  categoryFitsSlot,
  countInstalledElsewhere,
  countSlots,
  getOrCreateActiveProxy,
  installItem as installIntoChassisSlot,
  loadSlots,
} from "./proxies";
import type { ChassisSlot } from "./proxies";

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

export interface OreTypeMeta {
  tier: number;
  grade_values: number[];
  value_multiplier: number;
  depth_gate: number;
  adds_map_size: number;
}

export interface OreCatalogRow {
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
  sell_value: string | null;
  item_meta: { mining: OreTypeMeta } | null;
  created_at: string;
  updated_at: string;
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

// Scoped to `game`, not just `player_id` — player_inventory has no game
// column of its own (only item_catalog does), and a player owns/equips
// items across every game from the same shared table. Without this join,
// a game's inventory read silently includes every other game's rows too.
// `equipped_quantity` is always 0 for mining rows now (see
// db/021_migrate_mining_proxy.sql) — chassis_slots is the source of truth
// for what's installed; this column only still means something for games
// (refine) that haven't moved onto the slot model yet.
export async function loadInventory(
  playerId: string,
  game: string,
): Promise<InventoryRow[]> {
  const rows = await sql`
    select pi.item_key, pi.owned_quantity, pi.equipped_quantity
    from player_inventory pi
    join item_catalog ic on ic.item_key = pi.item_key
    where pi.player_id = ${playerId} and ic.game = ${game}
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

// Categories whose sell_value is a flat credit price rather than a ratio
// of the row's own cost (see the CatalogItem comment in
// app/games/mining/build/page.tsx and db/011_sell_prices.sql). Both share
// the same reason: cost is 0 for these (there's no buy side — you only
// ever acquire them by producing them), so `cost * sell_value` would
// always be 0. Ore was the original member; refined output (e.g. copper
// cathode, db/015_refine_catalog.sql) is the same shape for a different
// game, not a special case of it — extend this set rather than adding
// another `=== ORE_CATEGORY` check when the next game needs it too.
export const FLAT_SELL_PRICE_CATEGORIES = new Set(["ore", "refined"]);

// Mirrors purchaseItem()'s shape in reverse: credit first (atomic, so a
// race can't double-sell past what's actually available), then the
// inventory/ledger update as a batch. Only copies that aren't currently
// installed anywhere can be sold. For mining, "installed" means occupying
// a chassis_slots row on one of this character's proxies (see
// countInstalledElsewhere in lib/proxies.ts) — the same slot model
// equip/unequip uses, so sell can never leave a slot pointing at a
// quantity that's dropped below what's actually owned. Other games still
// read player_inventory.equipped_quantity, the pre-slot-model shape.
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

  const reserved =
    game === "mining"
      ? await (async () => {
          const characterId = await getOrCreateCharacter(playerId, "Pilot");
          return countInstalledElsewhere(characterId, itemKey);
        })()
      : row.equipped_quantity;

  const available = row.owned_quantity - reserved;
  if (quantity > available) return { kind: "insufficient_owned" };

  const unitPrice = FLAT_SELL_PRICE_CATEGORIES.has(row.category)
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

// Equipment items (ore siphon, line scanner) — and, later, the proxy-
// weapon class — only fit carriage slots (see CARRIAGE_CATEGORIES in
// lib/proxies.ts). Kept here too since a handful of call sites already
// reference it by this name.
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

export async function getOreItems(): Promise<OreCatalogRow[]> {
  const rows = await sql`

    select * from item_catalog
    where category='ore'
  `;

  return rows as OreCatalogRow[];
}

// Which mineral, not how good this particular pocket of it is — that's
// `grade` below. See build-spec-ore-progression.md, Stage 1.
export type OreTypeKey =
  | "copper"
  | "zinc"
  | "iron"
  | "silver"
  | "gold"
  | "platinum"
  | "silica"
  | "germanium"
  | "cadmium"
  | "neodymium"
  | "yttrium"
  | "lanthanum"
  | "tantalum";

export interface OreData extends OreTypeMeta {
  key: OreTypeKey;
  label: string;
  sell_value: string | null;
}

export async function loadOreData(): Promise<Record<string, OreData>> {
  const rows = await getOreItems();

  return rows.reduce<Record<string, OreData>>((a, c) => {
    if (!c.item_meta?.mining) return a;

    a[c.item_key] = {
      key: c.item_key as OreTypeKey,
      label: c.label,
      sell_value: c.sell_value,
      ...c.item_meta.mining,
    };

    return a;
  }, {});
}

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

// --- Chassis/slot model (mining's proxy) ---------------------------------
//
// mining is the first game moved onto the shared proxies/chassis_slots
// shape (see db/020_chassis_slots.sql, db/021_migrate_mining_proxy.sql,
// and the Smashies/arena metagame outline) — "equipped" is no longer a
// quantity on player_inventory, it's a real chassis_slots row pointing at
// an item_key. Every function below resolves playerId -> character ->
// this character's *active* mining proxy (see active_proxy_selection);
// since a character can own more than one proxy, "the chassis" always
// means whichever one is currently selected for 'mining', never just "a"
// proxy.

const MINING_GAME = "mining";
const MINING_PROXY_NAME = "Mining Chassis";

// Exported so hot multi-call sites (e.g. GET /api/inventory) can resolve
// once and reuse the result across several of the functions below instead
// of each one independently re-resolving the same character+proxy — see
// the efficiency note on this file's functions.
export async function resolveMiningProxy(
  playerId: string,
): Promise<{ characterId: string; proxyId: string }> {
  const characterId = await getOrCreateCharacter(playerId, "Pilot");
  const proxyId = await getOrCreateActiveProxy(
    characterId,
    MINING_GAME,
    MINING_PROXY_NAME,
    CFG.SLOT_TOTAL,
  );
  return { characterId, proxyId };
}

export async function loadMiningSlots(playerId: string): Promise<ChassisSlot[]> {
  const { proxyId } = await resolveMiningProxy(playerId);
  return loadSlots(proxyId);
}

export type InstallResult =
  | "ok"
  | "not_owned"
  | "wrong_slot_type"
  | "slot_not_found";

// Installing is what claims a copy now — there's no separate "equip"
// quantity to keep in sync. Ownership is checked as owned_quantity minus
// however many copies are already installed elsewhere across this
// character's proxies (see countInstalledElsewhere in lib/proxies.ts).
// Not wrapped in purchaseItem's race-proof machinery, same tradeoff the
// old setEquipped() accepted — this is a player editing their own
// loadout, not a money movement.
export async function installInSlot(
  playerId: string,
  slotId: string,
  itemKey: string,
): Promise<InstallResult> {
  const { characterId, proxyId } = await resolveMiningProxy(playerId);

  const [slot] = await sql`
    select id, slot_type, installed_item_id from chassis_slots
    where id = ${slotId} and proxy_id = ${proxyId}
  `;
  if (!slot) return "slot_not_found";
  if (slot.installed_item_id === itemKey) return "ok";

  const [item] = await sql`
    select category from item_catalog
    where item_key = ${itemKey} and game = ${MINING_GAME} and active = true
  `;
  if (!item || !categoryFitsSlot(item.category, slot.slot_type)) {
    return "wrong_slot_type";
  }

  const [owned] = await sql`
    select owned_quantity from player_inventory
    where player_id = ${playerId} and item_key = ${itemKey}
  `;
  const ownedQuantity = owned?.owned_quantity ?? 0;
  const installedElsewhere = await countInstalledElsewhere(
    characterId,
    itemKey,
    slotId,
  );
  if (ownedQuantity - installedElsewhere < 1) return "not_owned";

  await installIntoChassisSlot(slotId, itemKey);
  return "ok";
}

export async function clearSlot(
  playerId: string,
  slotId: string,
): Promise<InstallResult> {
  const { proxyId } = await resolveMiningProxy(playerId);
  const [slot] =
    await sql`select id from chassis_slots where id = ${slotId} and proxy_id = ${proxyId}`;
  if (!slot) return "slot_not_found";
  await installIntoChassisSlot(slotId, null);
  return "ok";
}

// Not equippable like everything else — owning one used to permanently
// raise slot capacity by 1. Now that expanding writes a real chassis_slots
// row directly (see purchaseChassisExpansion below), this key only still
// matters as the item_catalog row that prices the next expansion.
export const EXPANSION_ITEM_KEY = "chassis_expansion";

export async function getSlotTotal(playerId: string): Promise<number> {
  const { proxyId } = await resolveMiningProxy(playerId);
  return countSlots(proxyId, "standard");
}

// Each expansion costs double the last one, based on how many standard
// slots this specific proxy already has beyond the base CFG.SLOT_TOTAL —
// per-proxy, not per-player, since a character can own more than one
// chassis and each has its own slot count. +1 standard slot, empty, no
// item attached.
export async function purchaseChassisExpansion(
  playerId: string,
  game: string,
): Promise<PurchaseItemResult> {
  const [item] =
    await sql`select cost from item_catalog where item_key = ${EXPANSION_ITEM_KEY} and game = ${game} and active = true`;
  if (!item) return { kind: "not_found" };
  // This always expands the MINING chassis (resolveMiningProxy is hardcoded
  // to it) — genuinely mining-only for now, per the ore-progression build
  // spec's scoping. A refine/arena equivalent needs its own resolver before
  // this can honor an arbitrary `game`; until then, refuse rather than
  // silently expand the wrong game's chassis for a purchase logged under a
  // different game's ledger.
  if (game !== MINING_GAME) return { kind: "not_found" };

  const { proxyId } = await resolveMiningProxy(playerId);
  const standardCount = await countSlots(proxyId, "standard");
  const level = Math.max(0, standardCount - CFG.SLOT_TOTAL);
  const cost = Number(item.cost) * 2 ** level;

  const [deducted] = await sql`
    update players set balance = balance - ${cost}
    where id = ${playerId} and balance >= ${cost}
    returning balance
  `;
  if (!deducted) return { kind: "insufficient_funds" };

  await sql.transaction([
    sql`insert into chassis_slots (proxy_id, slot_type) values (${proxyId}, 'standard')`,
    sql`
      insert into balance_transactions (player_id, game, reason, delta)
      values (${playerId}, ${game}, 'chassis_expansion', ${-cost})
    `,
  ]);

  return { kind: "ok", balance: deducted.balance };
}

// A single, very expensive slot for single-use field tools (ore siphon,
// line scanner) — one carriage slot, period, not a repeatable doubling
// purchase like chassis expansion. See purchaseEquipmentSlotUnlock().
export const EQUIPMENT_SLOT_KEY = "equipment_slot_unlock";

export async function getEquipmentSlotTotal(playerId: string): Promise<number> {
  const { proxyId } = await resolveMiningProxy(playerId);
  return countSlots(proxyId, "carriage");
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
  // Mining-only for now — see the matching guard in purchaseChassisExpansion().
  if (game !== MINING_GAME) return { kind: "not_found" };
  const cost = Number(item.cost);

  const { proxyId } = await resolveMiningProxy(playerId);
  const carriageCount = await countSlots(proxyId, "carriage");
  if (carriageCount >= 1) return { kind: "already_owned" };

  const [deducted] = await sql`
    update players set balance = balance - ${cost}
    where id = ${playerId} and balance >= ${cost}
    returning balance
  `;
  if (!deducted) return { kind: "insufficient_funds" };

  // Race-proof one-time gate: player_inventory's unique (player_id,
  // item_key) constraint makes this insert a guaranteed no-op for a second
  // concurrent purchase (double-click, two tabs) — the countSlots() read
  // above can't rule that out on its own, since two requests can both see
  // 0 carriage slots before either commits. This row's quantities are
  // otherwise inert (same as chassis_expansion's vestigial player_
  // inventory rows) — chassis_slots is still the real state; this insert
  // exists purely as the atomic gate.
  const [gate] = await sql`
    insert into player_inventory (player_id, item_key, owned_quantity, equipped_quantity)
    values (${playerId}, ${EQUIPMENT_SLOT_KEY}, 1, 0)
    on conflict (player_id, item_key) do nothing
    returning item_key
  `;
  if (!gate) {
    await sql`update players set balance = balance + ${cost} where id = ${playerId}`;
    return { kind: "already_owned" };
  }

  await sql.transaction([
    sql`insert into chassis_slots (proxy_id, slot_type) values (${proxyId}, 'carriage')`,
    sql`
      insert into balance_transactions (player_id, game, reason, delta)
      values (${playerId}, ${game}, 'equipment_slot_unlock', ${-cost})
    `,
  ]);

  return { kind: "ok", balance: deducted.balance };
}

// Whether the player currently has a usable one of this equipped — checked
// live against chassis_slots at the moment a run action tries to use it,
// not snapshotted at launch like the rest of the loadout, since the whole
// point is that it can run out mid-run.
export async function hasEquippedConsumable(
  playerId: string,
  itemKey: string,
): Promise<boolean> {
  const { proxyId } = await resolveMiningProxy(playerId);
  const rows = await sql`
    select 1 from chassis_slots
    where proxy_id = ${proxyId} and installed_item_id = ${itemKey}
  `;
  return rows.length > 0;
}

// Called only after the run-state mutation it enabled has already
// succeeded (err-free) — a rejected/no-op use shouldn't cost the item.
// Clears whichever slot has it installed and drops the owned copy
// together — nothing is left "installed" once the only copy is gone.
export async function consumeEquippedItem(
  playerId: string,
  itemKey: string,
): Promise<void> {
  const { proxyId } = await resolveMiningProxy(playerId);
  // A single conditional UPDATE instead of select-then-update: clears
  // whichever slot has this item RIGHT NOW, atomically, so there's no
  // window where a concurrent equip/unequip on that same slot (e.g. via
  // the Build screen) could swap in a different item between the check
  // and the clear and have this wipe that item instead.
  const [slot] = await sql`
    update chassis_slots set installed_item_id = null, updated_at = now()
    where id = (
      select id from chassis_slots
      where proxy_id = ${proxyId} and installed_item_id = ${itemKey}
      limit 1
    )
    returning id
  `;
  if (!slot) return;

  await sql`
    update player_inventory set owned_quantity = owned_quantity - 1, updated_at = now()
    where player_id = ${playerId} and item_key = ${itemKey} and owned_quantity > 0
  `;
}

// Item keys currently installed in a carriage slot — what the client uses
// to decide which "use X" buttons to show during a run.
export async function loadEquipmentAvailable(
  playerId: string,
): Promise<string[]> {
  const { proxyId } = await resolveMiningProxy(playerId);
  const rows = await sql`
    select installed_item_id from chassis_slots
    where proxy_id = ${proxyId} and slot_type = 'carriage' and installed_item_id is not null
  `;
  return rows.map((r) => r.installed_item_id as string);
}

// Granted once, at account creation (see requestLogin() in lib/auth.ts,
// which only calls this for a genuinely new player row, never a returning
// one, and creates the character + mining proxy first). Unlike
// BASELINE_* below — an invisible stat floor applied at compute time,
// regardless of ownership — this is real owned inventory, installed into
// real slots on the new proxy: it shows up on the Build screen, it can be
// sold (once unequipped), it fills real chassis_slots rows.
//
// Tune this table directly — it's the one place these numbers live. The
// total (10) matches CFG.SLOT_TOTAL exactly on purpose: a fresh proxy has
// exactly enough standard slots to hold the whole starter kit.
export const STARTER_KIT: Record<string, number> = {
  fuel_basic: 4,
  drive_basic: 3,
  steer_basic: 2,
  cargo_basic: 1,
};

export async function grantStarterKit(playerId: string): Promise<void> {
  const writes = Object.entries(STARTER_KIT).map(
    ([itemKey, quantity]) => sql`
      insert into player_inventory (player_id, item_key, owned_quantity)
      values (${playerId}, ${itemKey}, ${quantity})
      on conflict (player_id, item_key) do nothing
    `,
  );
  await sql.transaction(writes);

  const { proxyId } = await resolveMiningProxy(playerId);
  const slots = await loadSlots(proxyId);
  const emptyStandard = slots.filter(
    (s) => s.slot_type === "standard" && !s.installed_item_id,
  );

  let cursor = 0;
  const installs: Promise<void>[] = [];
  for (const [itemKey, quantity] of Object.entries(STARTER_KIT)) {
    for (let i = 0; i < quantity && cursor < emptyStandard.length; i++) {
      installs.push(installIntoChassisSlot(emptyStandard[cursor++].id, itemKey));
    }
  }
  await Promise.all(installs);
}

// Every chassis has this much for free, before anything's equipped — one
// basic drive, one basic steer, one basic armor plate, three basic cargo
// units. Without it a totally bare chassis has 0 speed and 0 movement,
// which is a divide-by-zero in the fuel-cost math (1/speed), not just an
// undesirable default. Sourced from item_catalog itself (not hardcoded
// numbers) so a later balance change to these items' effects moves the
// floor too, instead of silently drifting out of sync with it. Unaffected
// by the move to real chassis_slots — this floor was never a real equip.
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

// Sums the baseline plus installed-slot effects into a stat-delta map,
// then hands it to the pure chassisFromEffects() — this is the one place
// inventory (DB) and engine (pure functions) meet. Each occupied slot
// contributes its item's effects exactly once, whether or not the same
// item_key also sits in another slot (that's what having two separate
// slot rows *means* now, in place of the old equipped_quantity multiplier).
export async function computeEffects(
  playerId: string,
): Promise<Partial<Record<StatKey, number>>> {
  const { proxyId } = await resolveMiningProxy(playerId);

  const [baselineRows, slotRows] = await Promise.all([
    sql`
      select item_key, effects from item_catalog
      where item_key in (${BASELINE_DRIVE}, ${BASELINE_STEER}, ${BASELINE_ARMOUR}, ${BASELINE_CARGO})
    `,
    sql`
      select ic.effects
      from chassis_slots cs
      join item_catalog ic on ic.item_key = cs.installed_item_id
      where cs.proxy_id = ${proxyId} and cs.installed_item_id is not null
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

  for (const row of slotRows) {
    addEffects(effects, row.effects as Partial<Record<StatKey, number>>, 1);
  }

  return effects;
}

export async function computeChassis(playerId: string): Promise<Chassis> {
  return chassisFromEffects(await computeEffects(playerId));
}

// Snapshot of what's actually installed at launch time, for runs.config —
// one row per occupied item_key, quantity = how many slots hold it.
export async function loadoutSnapshot(
  playerId: string,
): Promise<{ item_key: string; quantity: number }[]> {
  const { proxyId } = await resolveMiningProxy(playerId);
  const rows = await sql`
    select installed_item_id as item_key, count(*)::int as quantity
    from chassis_slots
    where proxy_id = ${proxyId} and installed_item_id is not null
    group by installed_item_id
  `;
  return rows.map((r) => ({
    item_key: r.item_key as string,
    quantity: r.quantity as number,
  }));
}
