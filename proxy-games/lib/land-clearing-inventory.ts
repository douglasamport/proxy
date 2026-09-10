// DB-facing inventory layer for land-clearing — same split as
// lib/mining-inventory.ts (pure engine vs. DB here), but land-clearing has
// no separate equipment pool like mining's ore-siphon/line-scanner slots —
// every equippable category here is chassis gear, scoped through
// proxy_loadout via lib/proxy-store.ts. loadCatalog/purchaseItem are
// reused unchanged from mining-inventory.ts (already game-generic); this
// file only adds what's actually land-clearing-specific: chassis math and
// the starter kit.
import { sql } from "@/db/client";
import { chassisFromEffects } from "./land-clearing-engine";
import type { Chassis, RawWeapon, StatKey } from "./land-clearing-engine";
import { getEquippedTotalAcrossProxies, getSlotTotal, getWeaponMountTotal } from "./proxy-store";
import { loadCatalog, purchaseItem } from "./mining-inventory";
import type { CatalogItem, PurchaseItemResult } from "./mining-inventory";

// Weapons draw from the weapon_mounts pool (db/022_weapon_mounts.sql), not
// the general chassis gear pool — same split as mining's equipment bay,
// just sized to carry several instead of one.
const WEAPON_CATEGORIES = new Set(["weapon", "ranged", "aoe"]);

export { loadCatalog, purchaseItem };
export type { CatalogItem, PurchaseItemResult };

export const GAME = "land_clearing";

export interface InventoryRow {
  item_key: string;
  owned_quantity: number;
  equipped_quantity: number;
}

// Every category here is chassis gear (no equipment-pool split like
// mining), so equipped_quantity always comes straight from proxy_loadout
// for this specific proxy.
export async function loadInventory(
  playerId: string,
  proxyId: string,
): Promise<InventoryRow[]> {
  const rows = await sql`
    select pi.item_key, pi.owned_quantity, coalesce(pl.equipped_quantity, 0) as equipped_quantity
    from player_inventory pi
    join item_catalog ic on ic.item_key = pi.item_key
    left join proxy_loadout pl on pl.item_key = pi.item_key and pl.proxy_id = ${proxyId}
    where pi.player_id = ${playerId} and ic.game = ${GAME}
  `;
  return rows as InventoryRow[];
}

// 'scrap' is salvage, not gear — never equippable, unlimited quantity, same
// non-equip shape as mining's ore categories. 'expansion' is the one-time
// slot-capacity purchase (see lib/proxy-store.ts) — also never equipped.
const NON_EQUIPPABLE_CATEGORIES = new Set(["scrap", "expansion"]);

export type SetEquippedResult = "ok" | "not_owned" | "over_cap";

export async function setEquipped(
  playerId: string,
  proxyId: string,
  itemKey: string,
  quantity: number,
): Promise<SetEquippedResult> {
  const [row] = await sql`
    select pi.owned_quantity, ic.category
    from player_inventory pi
    join item_catalog ic on ic.item_key = pi.item_key
    where pi.player_id = ${playerId} and pi.item_key = ${itemKey} and ic.game = ${GAME}
  `;
  if (!row || quantity < 0 || quantity > row.owned_quantity) return "not_owned";
  if (NON_EQUIPPABLE_CATEGORIES.has(row.category)) return "not_owned";

  const isWeapon = WEAPON_CATEGORIES.has(row.category);
  const cap = isWeapon ? await getWeaponMountTotal(proxyId) : await getSlotTotal(proxyId);

  // Scoped to the same pool the item being changed belongs to — a weapon's
  // count never competes with armor/drive/etc gear for the same slots, and
  // vice versa (see WEAPON_CATEGORIES above).
  const [{ total }] = await sql`
    select coalesce(sum(pl.equipped_quantity), 0)::int as total
    from proxy_loadout pl
    join item_catalog ic on ic.item_key = pl.item_key
    where pl.proxy_id = ${proxyId} and pl.item_key != ${itemKey} and ic.game = ${GAME}
      and (ic.category in ('weapon', 'ranged', 'aoe')) = ${isWeapon}
  `;
  if (total + quantity > cap) return "over_cap";

  await sql`
    insert into proxy_loadout (proxy_id, item_key, equipped_quantity)
    values (${proxyId}, ${itemKey}, ${quantity})
    on conflict (proxy_id, item_key)
    do update set equipped_quantity = excluded.equipped_quantity, updated_at = now()
  `;
  return "ok";
}

export type SellItemResult =
  | { kind: "ok"; balance: string }
  | { kind: "not_found" }
  | { kind: "not_sellable" }
  | { kind: "insufficient_owned" };

// 'scrap' sells at a flat price (cost is 0 — there's no buy side, see
// db/020_land_clearing_catalog.sql); everything else sells at a ratio of
// its own cost — same two-rule shape as mining's FLAT_SELL_PRICE_CATEGORIES.
const FLAT_SELL_PRICE_CATEGORIES = new Set(["scrap"]);

export async function sellItem(
  playerId: string,
  itemKey: string,
  quantity: number,
): Promise<SellItemResult> {
  const [row] = await sql`
    select ic.cost, ic.sellable, ic.sell_value, ic.category,
           coalesce(pi.owned_quantity, 0) as owned_quantity
    from item_catalog ic
    left join player_inventory pi on pi.item_key = ic.item_key and pi.player_id = ${playerId}
    where ic.item_key = ${itemKey} and ic.game = ${GAME} and ic.active = true
  `;
  if (!row) return { kind: "not_found" };
  if (!row.sellable || row.sell_value == null) return { kind: "not_sellable" };

  const reserved = NON_EQUIPPABLE_CATEGORIES.has(row.category)
    ? 0
    : await getEquippedTotalAcrossProxies(playerId, itemKey);
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
      values (${playerId}, ${GAME}, 'item_sale', ${proceeds})
    `,
    sql`update players set balance = balance + ${proceeds} where id = ${playerId}`,
  ]);

  const [{ balance }] = await sql`select balance from players where id = ${playerId}`;
  return { kind: "ok", balance };
}

// A bare chassis can move, fight a little, and see a couple tiles — not
// good, but not the divide-by-zero-style unplayable state a truly all-zero
// chassis would otherwise be if a player somehow launched with nothing
// equipped. Granted once, at first inventory touch (see grantStarterKit).
export const STARTER_KIT: Record<string, number> = {
  lc_weapon_basic: 1,
  lc_armor_basic: 1,
  lc_drive_basic: 1,
  lc_steer_basic: 1,
};

export async function grantStarterKit(playerId: string, proxyId: string): Promise<void> {
  const writes = Object.entries(STARTER_KIT).flatMap(([itemKey, quantity]) => [
    sql`
      insert into player_inventory (player_id, item_key, owned_quantity)
      values (${playerId}, ${itemKey}, ${quantity})
      on conflict (player_id, item_key) do nothing
    `,
    sql`
      insert into proxy_loadout (proxy_id, item_key, equipped_quantity)
      values (${proxyId}, ${itemKey}, ${quantity})
      on conflict (proxy_id, item_key) do nothing
    `,
  ]);
  await sql.transaction(writes);
}

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

// Weapons are kept OUT of the aggregate effects map — each equipped copy
// becomes its own RawWeapon entry instead (see WEAPON_CATEGORIES above and
// Chassis.weapons in lib/land-clearing-engine.ts), so 2 melee weapons and a
// ranged one stay 3 separate options, not one blended attack/range number.
export async function computeEffects(
  proxyId: string,
): Promise<{ effects: Partial<Record<StatKey, number>>; weapons: RawWeapon[] }> {
  const rows = await sql`
    select ic.category, ic.effects, pl.equipped_quantity
    from proxy_loadout pl
    join item_catalog ic on ic.item_key = pl.item_key
    where pl.proxy_id = ${proxyId} and pl.equipped_quantity > 0 and ic.game = ${GAME}
  `;
  const effects: Partial<Record<StatKey, number>> = {};
  const weapons: RawWeapon[] = [];
  for (const row of rows) {
    const rowEffects = row.effects as Partial<Record<StatKey, number>>;
    if (WEAPON_CATEGORIES.has(row.category)) {
      for (let i = 0; i < row.equipped_quantity; i++) {
        weapons.push({
          attack: rowEffects.attack ?? 0,
          range: rowEffects.range ?? 0,
          aoeRadius: rowEffects.aoeRadius ?? 0,
        });
      }
    } else {
      addEffects(effects, rowEffects, row.equipped_quantity);
    }
  }
  return { effects, weapons };
}

export async function computeChassis(proxyId: string): Promise<Chassis> {
  const { effects, weapons } = await computeEffects(proxyId);
  return chassisFromEffects(effects, weapons);
}

export async function loadoutSnapshot(
  proxyId: string,
): Promise<{ item_key: string; quantity: number }[]> {
  // Filtered to this game's own items — a proxy the player has chosen to
  // share across games (see the /proxies picker) can carry equipped rows
  // for other games too, and those shouldn't show up in a land-clearing
  // run's launch snapshot.
  const rows = await sql`
    select pl.item_key, pl.equipped_quantity as quantity
    from proxy_loadout pl
    join item_catalog ic on ic.item_key = pl.item_key
    where pl.proxy_id = ${proxyId} and pl.equipped_quantity > 0 and ic.game = ${GAME}
  `;
  return rows.map((r) => ({ item_key: r.item_key, quantity: r.quantity }));
}
