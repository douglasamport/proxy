// Shared chassis/slot primitives (see db/020_chassis_slots.sql and the
// Smashies/arena metagame outline) — a Proxy is a built-out chassis, one
// row per slot in chassis_slots. Game-agnostic on purpose: mining is the
// first consumer, refine and the arena are meant to move onto this same
// shape later rather than growing their own copy.
import { sql } from "@/db/client";

export type SlotType = "standard" | "carriage";

export interface ChassisSlot {
  id: string;
  slot_type: SlotType;
  installed_item_id: string | null;
}

// Slots that hold custom/utility equipment rather than a normal build
// part — mining's field-tool consumables today, weapons once the arena
// adds them. Kept here (not per-game) since the carriage/standard split is
// meant to mean the same thing everywhere.
export const CARRIAGE_CATEGORIES = new Set(["equipment", "weapon"]);

// Never equippable at all, in any slot — capacity/unlock items and things
// that live in plain inventory instead of a chassis slot.
const NON_EQUIPPABLE_CATEGORIES = new Set([
  "ore",
  "license",
  "expansion",
  "equipment_slot",
]);

export function categoryFitsSlot(category: string, slotType: SlotType): boolean {
  if (NON_EQUIPPABLE_CATEGORIES.has(category)) return false;
  return CARRIAGE_CATEGORIES.has(category) === (slotType === "carriage");
}

// The proxy a character currently has selected for `game` — created lazily
// (with `standardSlots` empty standard slots, 0 carriage) the first time a
// character needs one, so a brand-new signup doesn't need its own
// provisioning step beyond calling this. Existing players/games were
// backfilled directly (db/021_migrate_mining_proxy.sql for mining).
export async function getOrCreateActiveProxy(
  characterId: string,
  game: string,
  proxyName: string,
  standardSlots: number,
): Promise<string> {
  const [existing] = await sql`
    select proxy_id from active_proxy_selection
    where character_id = ${characterId} and game = ${game}
  `;
  if (existing) return existing.proxy_id;

  const [proxy] = await sql`
    insert into proxies (character_id, name)
    values (${characterId}, ${proxyName})
    returning id
  `;
  await sql`
    insert into chassis_slots (proxy_id, slot_type)
    select ${proxy.id}, 'standard' from generate_series(1, ${standardSlots})
  `;
  await sql`
    insert into active_proxy_selection (character_id, game, proxy_id)
    values (${characterId}, ${game}, ${proxy.id})
  `;
  return proxy.id;
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
