// Generic proxy (chassis) primitives — deliberately game-agnostic, unlike
// mining-inventory.ts/refine-inventory.ts. This is the shared foundation
// multiple games fit gear onto: each game's own inventory module computes
// its own stat math from proxy_loadout rows, but the proxy/loadout tables
// themselves, and slot-capacity bookkeeping, live here once.
import { sql } from "@/db/client";

export interface Proxy {
  id: string;
  player_id: string;
  name: string;
  slot_count: number;
  weapon_mounts: number;
}

export async function listProxies(playerId: string): Promise<Proxy[]> {
  const rows = await sql`
    select id, player_id, name, slot_count, weapon_mounts from proxies
    where player_id = ${playerId}
    order by created_at asc
  `;
  return rows as Proxy[];
}

export async function createProxy(playerId: string, name: string): Promise<Proxy> {
  const [created] = await sql`
    insert into proxies (player_id, name, slot_count)
    values (${playerId}, ${name}, ${BASE_SLOT_TOTAL})
    returning id, player_id, name, slot_count, weapon_mounts
  `;
  return created as Proxy;
}

// Which chassis is currently in the field for a given game — see
// db/019_proxy_selection.sql. Lazily creates and selects a fresh proxy on a
// player's first touch of a game (so nothing breaks for existing mining
// players, and a new game "just works" the first time), but from then on
// this is a real, switchable selection, not a guess — see setActiveProxy()
// and the /proxies picker UI.
export async function getActiveProxy(playerId: string, game: string): Promise<Proxy> {
  const [selected] = await sql`
    select p.id, p.player_id, p.name, p.slot_count, p.weapon_mounts
    from active_proxy_selection s
    join proxies p on p.id = s.proxy_id
    where s.player_id = ${playerId} and s.game = ${game}
  `;
  if (selected) return selected as Proxy;

  const proxy = await createProxy(playerId, "Proxy");
  await sql`
    insert into active_proxy_selection (player_id, game, proxy_id)
    values (${playerId}, ${game}, ${proxy.id})
    on conflict (player_id, game) do nothing
  `;
  return proxy;
}

export type SetActiveProxyResult = "ok" | "not_owned";

export async function setActiveProxy(
  playerId: string,
  game: string,
  proxyId: string,
): Promise<SetActiveProxyResult> {
  const [owned] = await sql`select id from proxies where id = ${proxyId} and player_id = ${playerId}`;
  if (!owned) return "not_owned";

  await sql`
    insert into active_proxy_selection (player_id, game, proxy_id, updated_at)
    values (${playerId}, ${game}, ${proxyId}, now())
    on conflict (player_id, game)
    do update set proxy_id = excluded.proxy_id, updated_at = now()
  `;
  return "ok";
}

export async function getSlotTotal(proxyId: string): Promise<number> {
  const [row] = await sql`select slot_count from proxies where id = ${proxyId}`;
  return row?.slot_count ?? 0;
}

// Raw fitted-items read — no ownership or game filtering here, that's each
// caller's job (a game's inventory module joins item_catalog with its own
// `game` filter before trusting these rows for stat math).
export async function loadProxyLoadout(
  proxyId: string,
): Promise<{ item_key: string; equipped_quantity: number }[]> {
  const rows = await sql`
    select item_key, equipped_quantity from proxy_loadout
    where proxy_id = ${proxyId} and equipped_quantity > 0
  `;
  return rows as { item_key: string; equipped_quantity: number }[];
}

export async function setProxyLoadoutQuantity(
  proxyId: string,
  itemKey: string,
  quantity: number,
): Promise<void> {
  await sql`
    insert into proxy_loadout (proxy_id, item_key, equipped_quantity)
    values (${proxyId}, ${itemKey}, ${quantity})
    on conflict (proxy_id, item_key)
    do update set equipped_quantity = excluded.equipped_quantity, updated_at = now()
  `;
}

// How many copies of one item are fitted across every proxy this player
// owns — not just the default one. Needed by sellItem() so selling an
// owned item can't go below what's actually installed on any chassis, once
// a player has more than one.
export async function getEquippedTotalAcrossProxies(
  playerId: string,
  itemKey: string,
): Promise<number> {
  const [{ total }] = await sql`
    select coalesce(sum(pl.equipped_quantity), 0)::int as total
    from proxy_loadout pl
    join proxies p on p.id = pl.proxy_id
    where p.player_id = ${playerId} and pl.item_key = ${itemKey}
  `;
  return total;
}

// Not equippable like chassis gear — owning one permanently raises this
// specific proxy's slot capacity by exactly 1. slot_count on `proxies` is
// the single source of truth for chassis capacity now, so the doubling
// price is derived from how far above baseline this proxy already sits,
// not from a separate purchase-history row.
//
// Looked up by category, not a fixed item_key: item_catalog.item_key is a
// global primary key, so each game needs its OWN row for this (mining's is
// literally 'chassis_expansion' — see db/006_chassis_expansion.sql; a
// second game can't reuse that key, just the 'expansion' category
// convention). One row per game, found by (game, category).
export const EXPANSION_CATEGORY = "expansion";
const BASE_SLOT_TOTAL = 10;

export type PurchaseChassisExpansionResult =
  | { kind: "ok"; balance: string; slotTotal: number }
  | { kind: "insufficient_funds" }
  | { kind: "not_found" };

export async function purchaseChassisExpansion(
  playerId: string,
  proxyId: string,
  game: string,
): Promise<PurchaseChassisExpansionResult> {
  const [item] =
    await sql`select cost from item_catalog where category = ${EXPANSION_CATEGORY} and game = ${game} and active = true`;
  if (!item) return { kind: "not_found" };

  const [proxy] =
    await sql`select slot_count from proxies where id = ${proxyId} and player_id = ${playerId}`;
  if (!proxy) return { kind: "not_found" };

  const level = proxy.slot_count - BASE_SLOT_TOTAL;
  const cost = Number(item.cost) * 2 ** level;

  const [deducted] = await sql`
    update players set balance = balance - ${cost}
    where id = ${playerId} and balance >= ${cost}
    returning balance
  `;
  if (!deducted) return { kind: "insufficient_funds" };

  const results = await sql.transaction([
    sql`
      update proxies set slot_count = slot_count + 1, updated_at = now()
      where id = ${proxyId}
      returning slot_count
    `,
    sql`
      insert into balance_transactions (player_id, game, reason, delta)
      values (${playerId}, ${game}, 'chassis_expansion', ${-cost})
    `,
  ]);
  const [{ slot_count }] = results[0] as { slot_count: number }[];

  return { kind: "ok", balance: deducted.balance, slotTotal: slot_count };
}

export async function getWeaponMountTotal(proxyId: string): Promise<number> {
  const [row] = await sql`select weapon_mounts from proxies where id = ${proxyId}`;
  return row?.weapon_mounts ?? 0;
}

// Same doubling-price mechanic as purchaseChassisExpansion() above, on the
// separate weapon_mounts pool instead of slot_count — see
// db/022_weapon_mounts.sql for why weapons get their own capacity rather
// than sharing the general chassis gear pool.
export const WEAPON_MOUNT_CATEGORY = "weapon_mount";
const BASE_WEAPON_MOUNTS = 1;

export type PurchaseWeaponMountResult =
  | { kind: "ok"; balance: string; weaponMounts: number }
  | { kind: "insufficient_funds" }
  | { kind: "not_found" };

export async function purchaseWeaponMountExpansion(
  playerId: string,
  proxyId: string,
  game: string,
): Promise<PurchaseWeaponMountResult> {
  const [item] =
    await sql`select cost from item_catalog where category = ${WEAPON_MOUNT_CATEGORY} and game = ${game} and active = true`;
  if (!item) return { kind: "not_found" };

  const [proxy] =
    await sql`select weapon_mounts from proxies where id = ${proxyId} and player_id = ${playerId}`;
  if (!proxy) return { kind: "not_found" };

  const level = proxy.weapon_mounts - BASE_WEAPON_MOUNTS;
  const cost = Number(item.cost) * 2 ** level;

  const [deducted] = await sql`
    update players set balance = balance - ${cost}
    where id = ${playerId} and balance >= ${cost}
    returning balance
  `;
  if (!deducted) return { kind: "insufficient_funds" };

  const results = await sql.transaction([
    sql`
      update proxies set weapon_mounts = weapon_mounts + 1, updated_at = now()
      where id = ${proxyId}
      returning weapon_mounts
    `,
    sql`
      insert into balance_transactions (player_id, game, reason, delta)
      values (${playerId}, ${game}, 'weapon_mount_expansion', ${-cost})
    `,
  ]);
  const [{ weapon_mounts }] = results[0] as { weapon_mounts: number }[];

  return { kind: "ok", balance: deducted.balance, weaponMounts: weapon_mounts };
}
