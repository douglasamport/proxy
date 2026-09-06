// DB-facing inventory layer for the Refinery minigame — the refine
// equivalent of lib/mining-inventory.ts. Deliberately imports the generic
// catalog/purchase/sell/equip functions from there rather than
// re-implementing them: loadCatalog(game), purchaseItem(playerId, game, ...)
// etc. already take `game` as a plain argument and touch no mining-specific
// tables, so they work for 'refine' unchanged. This file only adds what's
// actually refine-specific: the starter kit, the furnace/vat/cooler ->
// RefineRig math, and per-mineral ore/output bookkeeping.
import { sql } from "@/db/client";
import { rigFromEffects, PART_CATEGORIES } from "./refine-engine";
import type { RefineRig, StatKey, PartCategory } from "./refine-engine";
import { loadUnlockedOreTypes } from "./mining-inventory";
import type { OreTypeKey } from "./mining-engine";
import { ORE_TYPES } from "./mining-engine";

export { PART_CATEGORIES };
export type { PartCategory };
import {
  loadCatalog,
  loadInventory,
  purchaseItem,
  sellItem,
  setEquipped,
} from "./mining-inventory";
import type {
  CatalogItem,
  InventoryRow,
  PurchaseItemResult,
  SellItemResult,
  SetEquippedResult,
} from "./mining-inventory";

export { loadCatalog, loadInventory, purchaseItem, sellItem, setEquipped };
export type {
  CatalogItem,
  InventoryRow,
  PurchaseItemResult,
  SellItemResult,
  SetEquippedResult,
};

export const GAME = "refine";

// Ore item_keys equal the OreTypeKey strings themselves (see db/010's ore
// rows) — mining's extraction and refine's batches read/write the exact
// same player_inventory row for a given mineral, since that table was
// never scoped by game in the first place (only item_catalog is).
export function oreItemKey(oreType: OreTypeKey): string {
  return oreType;
}

// One refined-output item per mineral, in the real-world form that
// mineral is actually refined into (rare earths as oxides/powder, not a
// uniform "ingot" — see db/015 and db/016's comments). copper_cathode
// shipped first as the MVP; the other 12 are db/016_refine_expansion.sql.
const REFINED_OUTPUT_ITEM_KEYS: Record<OreTypeKey, string> = {
  copper: "copper_cathode",
  zinc: "zinc_ingot",
  iron: "iron_ingot",
  silver: "silver_bar",
  gold: "gold_bar",
  platinum: "platinum_ingot",
  silica: "refined_silicon",
  germanium: "germanium_ingot",
  cadmium: "cadmium_ingot",
  neodymium: "neodymium_oxide",
  yttrium: "yttrium_oxide",
  lanthanum: "lanthanum_oxide",
  tantalum: "tantalum_powder",
};

export function refinedOutputItemKey(oreType: OreTypeKey): string {
  return REFINED_OUTPUT_ITEM_KEYS[oreType];
}

// One of each basic part — furnace, vat, cooling fins — granted at account
// creation exactly like mining's STARTER_KIT (see grantStarterKit() in
// lib/mining-inventory.ts), so a new player can run a batch immediately and
// the refine store is pure upgrades from day one.
export const REFINE_STARTER_KIT: Record<string, number> = {
  furnace_basic: 1,
  vat_basic: 1,
  cooler_basic: 1,
  heater_basic: 1,
  radiator_basic: 1,
  valve_basic: 1,
};

export async function grantRefineStarterKit(playerId: string): Promise<void> {
  const writes = Object.entries(REFINE_STARTER_KIT).map(
    ([itemKey, quantity]) => sql`
      insert into player_inventory (player_id, item_key, owned_quantity, equipped_quantity)
      values (${playerId}, ${itemKey}, ${quantity}, ${quantity})
      on conflict (player_id, item_key) do nothing
    `,
  );
  await sql.transaction(writes);
}

// Sums equipped part effects into a stat-delta map — the refine equivalent
// of computeEffects() in lib/mining-inventory.ts. Only one equipped copy of
// each category matters (see setActivePart() below) — a player who somehow
// owns and equips two coolers just gets both effects summed, which is
// harmless since setActivePart() never lets that happen through the
// normal UI.
//
// Reads PART_CATEGORIES directly rather than a hardcoded list — a
// hardcoded ('furnace', 'vat', 'cooler') here silently ignored
// heater/radiator/valve for as long as they existed as PART_CATEGORIES
// entries without this query being updated to match: equipping any of the
// three did nothing at all, because their effects were never even
// selected, so the rig always fell back to rigFromEffects()'s defaults
// regardless of what was actually equipped.
export async function computeRefineEffects(
  playerId: string,
): Promise<Partial<Record<StatKey, number>>> {
  const rows = await sql`
    select ic.effects, pi.equipped_quantity
    from player_inventory pi
    join item_catalog ic on ic.item_key = pi.item_key
    where pi.player_id = ${playerId} and ic.game = ${GAME} and pi.equipped_quantity > 0
      and ic.category = any(${PART_CATEGORIES})
  `;

  const effects: Partial<Record<StatKey, number>> = {};
  for (const row of rows) {
    const rowEffects = row.effects as Partial<Record<StatKey, number>>;
    const qty = row.equipped_quantity as number;
    for (const key of Object.keys(rowEffects) as StatKey[]) {
      effects[key] = (effects[key] ?? 0) + (rowEffects[key] ?? 0) * qty;
    }
  }
  return effects;
}

export async function computeRefineRig(playerId: string): Promise<RefineRig> {
  return rigFromEffects(await computeRefineEffects(playerId));
}

export interface OreOption {
  oreType: OreTypeKey;
  label: string;
  available: number;
}

// Every mineral the player has unlocked (via mining's licences —
// loadUnlockedOreTypes() is already fully generic, not mining-scoped
// beyond reading the same shared player_inventory/item_catalog rows),
// paired with how much of each they can actually bid with right now. This
// is what populates the sizing screen's ore picker.
export async function loadOreOptions(playerId: string): Promise<OreOption[]> {
  const unlocked = await loadUnlockedOreTypes(playerId);
  const rows = await sql`
    select item_key, owned_quantity, equipped_quantity from player_inventory
    where player_id = ${playerId} and item_key = any(${unlocked})
  `;
  const byKey = new Map(
    rows.map((r) => [
      r.item_key as string,
      Math.max(0, r.owned_quantity - r.equipped_quantity),
    ]),
  );
  return unlocked.map((oreType) => ({
    oreType,
    label: ORE_TYPES[oreType].label,
    available: byKey.get(oreType) ?? 0,
  }));
}

// How much of one mineral the player can actually bid with — reads the
// same player_inventory row mining's extraction wrote to (see db/015's
// comment: ore isn't scoped by game at the inventory level, only
// item_catalog is). Available, not owned: mirrors sellItem()'s
// owned-minus-equipped convention, in case ore ever ends up with a nonzero
// equipped_quantity.
export async function loadAvailableOre(
  playerId: string,
  oreType: OreTypeKey,
): Promise<number> {
  const [row] = await sql`
    select owned_quantity, equipped_quantity from player_inventory
    where player_id = ${playerId} and item_key = ${oreItemKey(oreType)}
  `;
  if (!row) return 0;
  return Math.max(0, row.owned_quantity - row.equipped_quantity);
}

// Deducts committed ore at batch launch. Not wrapped in the same
// atomic-conditional-update pattern purchaseItem() uses for money, because
// the caller (launchBatch in lib/refine-batch-store.ts) has already
// re-checked loadAvailableOre() against the requested bid in the same
// request — good enough for a single-player batch commitment, same trust
// level as mining's claim-cost checks.
export async function debitOre(
  playerId: string,
  oreType: OreTypeKey,
  units: number,
): Promise<void> {
  await sql`
    update player_inventory set owned_quantity = owned_quantity - ${units}, updated_at = now()
    where player_id = ${playerId} and item_key = ${oreItemKey(oreType)}
  `;
}

// Returns unmelted ore to the player on a deliberate shutdown (§6.4) — never
// called on overheat, where that ore is destroyed instead.
export async function creditOre(
  playerId: string,
  oreType: OreTypeKey,
  units: number,
): Promise<void> {
  if (units <= 0) return;
  await sql`
    update player_inventory set owned_quantity = owned_quantity + ${units}, updated_at = now()
    where player_id = ${playerId} and item_key = ${oreItemKey(oreType)}
  `;
}

// Furnace/vat/cooler are a "pick one active part per category" model, not
// mining's stacking multi-slot equip (owning 3 fuel cells and equipping 2
// of them). Reusing setEquipped()/the shared slot-cap machinery here would
// be actively wrong: it sums equipped_quantity across every non-'equipment'
// category into ONE pool sized by mining's CFG.SLOT_TOTAL, so a refine
// part would silently compete for mining's 10 chassis slots. This is a
// separate, simpler primitive instead — activating one item in a category
// deactivates every other owned item in that same category, atomically.
export type SetActivePartResult = "ok" | "not_owned";

export async function setActivePart(
  playerId: string,
  category: PartCategory,
  itemKey: string,
): Promise<SetActivePartResult> {
  const [row] = await sql`
    select pi.owned_quantity from player_inventory pi
    join item_catalog ic on ic.item_key = pi.item_key
    where pi.player_id = ${playerId} and pi.item_key = ${itemKey}
      and ic.game = ${GAME} and ic.category = ${category}
  `;
  if (!row || row.owned_quantity < 1) return "not_owned";

  await sql.transaction([
    sql`
      update player_inventory set equipped_quantity = 0, updated_at = now()
      where player_id = ${playerId} and equipped_quantity > 0 and item_key in (
        select item_key from item_catalog where game = ${GAME} and category = ${category}
      )
    `,
    sql`
      update player_inventory set equipped_quantity = 1, updated_at = now()
      where player_id = ${playerId} and item_key = ${itemKey}
    `,
  ]);
  return "ok";
}

// Credits finished output at batch end, into the item for whichever
// mineral the batch actually refined.
export async function creditRefinedOutput(
  playerId: string,
  oreType: OreTypeKey,
  units: number,
): Promise<void> {
  if (units <= 0) return;
  await sql`
    insert into player_inventory (player_id, item_key, owned_quantity)
    values (${playerId}, ${refinedOutputItemKey(oreType)}, ${units})
    on conflict (player_id, item_key)
    do update set owned_quantity = player_inventory.owned_quantity + excluded.owned_quantity, updated_at = now()
  `;
}

// The Coolant Flush consumable (db/016_refine_expansion.sql) — deliberately
// NOT wired through mining's equip-slot system (see the migration's
// comment); just a plain owned_quantity check-and-decrement.
export const COOLANT_ITEM_KEY = "coolant_flush";

export async function loadCoolantCount(playerId: string): Promise<number> {
  const [row] = await sql`
    select owned_quantity from player_inventory
    where player_id = ${playerId} and item_key = ${COOLANT_ITEM_KEY}
  `;
  return row?.owned_quantity ?? 0;
}

export type ConsumeCoolantResult = "ok" | "not_owned";

export async function consumeCoolant(
  playerId: string,
): Promise<ConsumeCoolantResult> {
  const [row] = await sql`
    update player_inventory set owned_quantity = owned_quantity - 1, updated_at = now()
    where player_id = ${playerId} and item_key = ${COOLANT_ITEM_KEY} and owned_quantity > 0
    returning item_key
  `;
  return row ? "ok" : "not_owned";
}

// The Auto-Decanter unlock (db/017_refine_precision_gear.sql) — a
// permanent, non-consumed feature gate, same one-time-gate shape as
// mining's equipment_slot_unlock: owning 1 means unlocked, never consumed.
export const DECANTER_AUTO_ITEM_KEY = "decanter_auto";

export async function hasDecanterAuto(playerId: string): Promise<boolean> {
  const [row] = await sql`
    select owned_quantity from player_inventory
    where player_id = ${playerId} and item_key = ${DECANTER_AUTO_ITEM_KEY}
  `;
  return (row?.owned_quantity ?? 0) > 0;
}
