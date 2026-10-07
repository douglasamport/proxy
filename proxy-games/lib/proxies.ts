// Shared chassis/slot primitives (see db/020_chassis_slots.sql and the
// Smashies/arena metagame outline) — a Proxy is a built-out chassis, one
// row per slot in chassis_slots. Game-agnostic on purpose: mining is the
// first consumer, refine and the arena are meant to move onto this same
// shape later rather than growing their own copy.
import { randomUUID } from "crypto";
import { sql } from "@/db/client";
import { categoryFitsSlot, CARRIAGE_CATEGORIES } from "./slot-categories";
import type { SlotType } from "./slot-categories";

export type { SlotType };
export { categoryFitsSlot, CARRIAGE_CATEGORIES };

export interface ChassisSlot {
  id: string;
  slot_type: SlotType;
  installed_item_id: string | null;
}

// The proxy a character has assigned to `activityType` ('extraction',
// later 'refining', 'arena', ...) — one row per character per activity
// (unique(character_id, activity_type) on active_proxy_selection); the same
// proxy may be assigned to several activities. READ-ONLY: a character with
// no chassis assigned gets null back, never a free one — chassis are only
// ever created by createChassis() (starter kit at signup, or bought from
// the Mechanic).
export async function getAssignedProxy(
  characterId: string,
  activityType: string,
): Promise<string | null> {
  const [row] = await sql`
    select proxy_id from active_proxy_selection
    where character_id = ${characterId} and activity_type = ${activityType}
  `;
  return (row?.proxy_id as string | undefined) ?? null;
}

// The statements that create one chassis with `standardSlots` empty
// standard slots, for callers that need to batch them with other writes
// (the Mechanic's purchase adds a ledger row to the same transaction).
export function chassisInsertStatements(
  id: string,
  characterId: string,
  name: string,
  standardSlots: number,
) {
  return [
    sql`insert into proxies (id, character_id, name) values (${id}, ${characterId}, ${name})`,
    sql`
      insert into chassis_slots (proxy_id, slot_type)
      select ${id}, 'standard' from generate_series(1, ${standardSlots})
    `,
  ];
}

export async function createChassis(
  characterId: string,
  name: string,
  standardSlots: number,
): Promise<string> {
  const id = randomUUID();
  await sql.transaction(
    chassisInsertStatements(id, characterId, name, standardSlots),
  );
  return id;
}

export async function assignProxy(
  characterId: string,
  activityType: string,
  proxyId: string,
): Promise<void> {
  await sql`
    insert into active_proxy_selection (character_id, activity_type, proxy_id)
    values (${characterId}, ${activityType}, ${proxyId})
    on conflict (character_id, activity_type)
    do update set proxy_id = excluded.proxy_id, updated_at = now()
  `;
}

export async function unassignProxy(
  characterId: string,
  activityType: string,
): Promise<void> {
  await sql`
    delete from active_proxy_selection
    where character_id = ${characterId} and activity_type = ${activityType}
  `;
}

export interface ProxySummary {
  id: string;
  name: string;
  created_at: string;
  standard: number;
  carriage: number;
  filled: number;
  /** Activity types this chassis is currently assigned to. */
  assigned: string[];
}

// Every chassis a character owns, oldest first, with slot counts and which
// activities each is assigned to.
export async function listProxies(characterId: string): Promise<ProxySummary[]> {
  const rows = await sql`
    select p.id, p.name, p.created_at,
      count(cs.id) filter (where cs.slot_type = 'standard')::int as standard,
      count(cs.id) filter (where cs.slot_type = 'carriage')::int as carriage,
      count(cs.installed_item_id)::int as filled,
      coalesce(
        (select array_agg(a.activity_type order by a.activity_type)
         from active_proxy_selection a where a.proxy_id = p.id),
        '{}'
      ) as assigned
    from proxies p
    left join chassis_slots cs on cs.proxy_id = p.id
    where p.character_id = ${characterId}
    group by p.id
    order by p.created_at, p.id
  `;
  return rows as ProxySummary[];
}

// How many copies of each item are fitted across ALL of a character's
// chassis — gear is one shared pool, so this is what's "spoken for".
export async function countInstalledByItem(
  characterId: string,
): Promise<Record<string, number>> {
  const rows = await sql`
    select cs.installed_item_id as item_key, count(*)::int as n
    from chassis_slots cs
    join proxies p on p.id = cs.proxy_id
    where p.character_id = ${characterId} and cs.installed_item_id is not null
    group by cs.installed_item_id
  `;
  return Object.fromEntries(rows.map((r) => [r.item_key as string, r.n as number]));
}

// Ownership check shared by every per-chassis action.
export async function ownsProxy(
  characterId: string,
  proxyId: string,
): Promise<boolean> {
  const [row] = await sql`
    select 1 as ok from proxies where id = ${proxyId} and character_id = ${characterId}
  `;
  return !!row;
}

export async function loadProxyName(proxyId: string): Promise<string | null> {
  const [row] = await sql`select name from proxies where id = ${proxyId}`;
  return (row?.name as string | undefined) ?? null;
}

export async function loadSlots(proxyId: string): Promise<ChassisSlot[]> {
  const rows = await sql`
    select id, slot_type, installed_item_id
    from chassis_slots
    where proxy_id = ${proxyId}
    order by slot_type, id
  `;
  return rows as ChassisSlot[];
}

export async function countSlots(
  proxyId: string,
  slotType: SlotType,
): Promise<number> {
  const [{ count }] = await sql`
    select count(*)::int as count from chassis_slots
    where proxy_id = ${proxyId} and slot_type = ${slotType}
  `;
  return count;
}

export async function addSlot(proxyId: string, slotType: SlotType): Promise<string> {
  const [row] = await sql`
    insert into chassis_slots (proxy_id, slot_type)
    values (${proxyId}, ${slotType})
    returning id
  `;
  return row.id;
}

// How many copies of itemKey are currently installed across every proxy a
// character owns (not just the active one for a given game) — the real
// "spoken for" count ownership checks need, now that installing something
// into a slot is what claims a copy instead of a separate equipped_
// quantity counter.
export async function countInstalledElsewhere(
  characterId: string,
  itemKey: string,
  excludeSlotId?: string,
): Promise<number> {
  const rows = await sql`
    select cs.id from chassis_slots cs
    join proxies p on p.id = cs.proxy_id
    where p.character_id = ${characterId} and cs.installed_item_id = ${itemKey}
      and cs.id != ${excludeSlotId ?? "00000000-0000-0000-0000-000000000000"}
  `;
  return rows.length;
}

export async function installItem(
  slotId: string,
  itemKey: string | null,
): Promise<void> {
  await sql`
    update chassis_slots set installed_item_id = ${itemKey}, updated_at = now()
    where id = ${slotId}
  `;
}
