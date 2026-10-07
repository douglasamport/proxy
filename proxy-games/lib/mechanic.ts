// The Mechanic site's logic (see db/032_mechanic.sql) plus the chassis
// management actions on /proxies: buying a new chassis, upgrading one
// specific chassis, scrapping, renaming, and assigning a chassis to an
// activity. Every action here targets ONE chassis by id and checks it
// belongs to the player's character — nothing depends on which chassis
// happens to be "active".
//
// Money rule everywhere: a conditional `update players ... where balance >=
// cost` runs first (so a race can't overspend), then the writes; if the
// writes don't land, the charge is refunded.
import { randomUUID } from "crypto";
import { sql } from "@/db/client";
import { CFG } from "./mining-engine";
import { purchaseItem, sellItem } from "./mining-inventory";
import { getOrCreateCharacter } from "./characters";
import {
  chassisInsertStatements,
  countSlots,
  ownsProxy,
  assignProxy,
  unassignProxy,
} from "./proxies";

export const CHASSIS_ITEM_KEY = "chassis";
export const EXPANSION_ITEM_KEY = "chassis_expansion";
export const EQUIPMENT_SLOT_KEY = "equipment_slot_unlock";

export const MAX_CHASSIS_NAME = 24;
// Scrapping pays (total slots / 2) x this — brutal on purpose: half the
// price of a bare chassis back, nothing for the upgrades beyond that rate.
export const SCRAP_CREDITS_PER_TWO_SLOTS = 1000;
// Activity types a chassis can be assigned to today. Refining still uses
// its own rig and arena doesn't exist yet (see TODO).
export const ASSIGNABLE_ACTIVITIES = ["extraction"] as const;

export function normaliseChassisName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= MAX_CHASSIS_NAME ? name : null;
}

export function scrapValue(totalSlots: number): number {
  return (totalSlots / 2) * SCRAP_CREDITS_PER_TWO_SLOTS;
}

// Price of the next standard slot on a chassis that already has
// `standardSlots` of them: doubles with each slot beyond the base.
export function expansionCost(baseCost: number, standardSlots: number): number {
  return baseCost * 2 ** Math.max(0, standardSlots - CFG.SLOT_TOTAL);
}

export interface MechanicPrices {
  chassis: number | null;
  expansion: number | null;
  equipmentBay: number | null;
}

export async function loadMechanicPrices(): Promise<MechanicPrices> {
  const rows = await sql`
    select item_key, cost from item_catalog
    where item_key in (${CHASSIS_ITEM_KEY}, ${EXPANSION_ITEM_KEY}, ${EQUIPMENT_SLOT_KEY})
      and active = true
  `;
  const cost = (key: string) => {
    const row = rows.find((r) => r.item_key === key);
    return row ? Number(row.cost) : null;
  };
  return {
    chassis: cost(CHASSIS_ITEM_KEY),
    expansion: cost(EXPANSION_ITEM_KEY),
    equipmentBay: cost(EQUIPMENT_SLOT_KEY),
  };
}

type Charged =
  | { kind: "ok"; balance: string }
  | { kind: "insufficient_funds" }
  | { kind: "not_found" };

async function charge(playerId: string, cost: number): Promise<string | null> {
  const [row] = await sql`
    update players set balance = balance - ${cost}
    where id = ${playerId} and balance >= ${cost}
    returning balance
  `;
  return row ? (row.balance as string) : null;
}

async function refund(playerId: string, cost: number): Promise<void> {
  await sql`update players set balance = balance + ${cost} where id = ${playerId}`;
}

// --- buy a new chassis -----------------------------------------------------

export type BuyChassisResult =
  | { kind: "ok"; balance: string; proxyId: string }
  | { kind: "insufficient_funds" }
  | { kind: "invalid_name" }
  | { kind: "not_found" };

export async function buyChassis(
  playerId: string,
  siteId: string,
  rawName: unknown,
): Promise<BuyChassisResult> {
  const name = normaliseChassisName(rawName);
  if (!name) return { kind: "invalid_name" };

  const { chassis: cost } = await loadMechanicPrices();
  if (cost == null) return { kind: "not_found" };

  const characterId = await getOrCreateCharacter(playerId, "Pilot");
  const balance = await charge(playerId, cost);
  if (balance == null) return { kind: "insufficient_funds" };

  const id = randomUUID();
  try {
    await sql.transaction([
      ...chassisInsertStatements(id, characterId, name, CFG.SLOT_TOTAL),
      sql`
        insert into balance_transactions (player_id, site_id, reason, delta)
        values (${playerId}, ${siteId}, 'chassis_purchase', ${-cost})
      `,
    ]);
  } catch (e) {
    await refund(playerId, cost);
    throw e;
  }
  return { kind: "ok", balance, proxyId: id };
}

// --- upgrade one chassis ---------------------------------------------------

export async function expandChassis(
  playerId: string,
  siteId: string,
  proxyId: string,
): Promise<Charged & { slotTotal?: number }> {
  const characterId = await getOrCreateCharacter(playerId, "Pilot");
  if (!(await ownsProxy(characterId, proxyId))) return { kind: "not_found" };

  const { expansion: base } = await loadMechanicPrices();
  if (base == null) return { kind: "not_found" };

  const standard = await countSlots(proxyId, "standard");
  const cost = expansionCost(base, standard);

  const balance = await charge(playerId, cost);
  if (balance == null) return { kind: "insufficient_funds" };

  try {
    await sql.transaction([
      sql`insert into chassis_slots (proxy_id, slot_type) values (${proxyId}, 'standard')`,
      sql`
        insert into balance_transactions (player_id, site_id, reason, delta)
        values (${playerId}, ${siteId}, 'chassis_expansion', ${-cost})
      `,
    ]);
  } catch (e) {
    await refund(playerId, cost);
    throw e;
  }
  return { kind: "ok", balance, slotTotal: standard + 1 };
}

// --- equipment bay (one carriage slot per chassis) -------------------------

export type EquipmentBayResult =
  | { kind: "ok"; balance: string }
  | { kind: "insufficient_funds" }
  | { kind: "not_found" }
  | { kind: "already_owned" };

export async function buyEquipmentBay(
  playerId: string,
  siteId: string,
  proxyId: string,
): Promise<EquipmentBayResult> {
  const characterId = await getOrCreateCharacter(playerId, "Pilot");
  if (!(await ownsProxy(characterId, proxyId))) return { kind: "not_found" };

  const { equipmentBay: cost } = await loadMechanicPrices();
  if (cost == null) return { kind: "not_found" };
  if ((await countSlots(proxyId, "carriage")) >= 1) {
    return { kind: "already_owned" };
  }

  const balance = await charge(playerId, cost);
  if (balance == null) return { kind: "insufficient_funds" };

  // Race-proof one-per-chassis gate: the insert only happens if the chassis
  // still has no carriage slot, so two concurrent purchases can't both land.
  const inserted = await sql`
    insert into chassis_slots (proxy_id, slot_type)
    select ${proxyId}, 'carriage'
    where not exists (
      select 1 from chassis_slots where proxy_id = ${proxyId} and slot_type = 'carriage'
    )
    returning id
  `;
  if (inserted.length === 0) {
    await refund(playerId, cost);
    return { kind: "already_owned" };
  }
  await sql`
    insert into balance_transactions (player_id, site_id, reason, delta)
    values (${playerId}, ${siteId}, 'equipment_slot_unlock', ${-cost})
  `;
  return { kind: "ok", balance };
}

// --- manage a chassis (/proxies) -------------------------------------------

export async function renameChassis(
  playerId: string,
  proxyId: string,
  rawName: unknown,
): Promise<"ok" | "invalid_name" | "not_found"> {
  const name = normaliseChassisName(rawName);
  if (!name) return "invalid_name";
  const characterId = await getOrCreateCharacter(playerId, "Pilot");
  const rows = await sql`
    update proxies set name = ${name}, updated_at = now()
    where id = ${proxyId} and character_id = ${characterId}
    returning id
  `;
  return rows.length ? "ok" : "not_found";
}

// Assigns the chassis to an activity (it replaces whichever chassis the
// character had there), or removes that assignment. One chassis may hold
// several activities; one activity has at most one chassis.
export async function setChassisAssignment(
  playerId: string,
  proxyId: string,
  activityType: string,
  assigned: boolean,
): Promise<"ok" | "invalid_activity" | "not_found"> {
  if (!(ASSIGNABLE_ACTIVITIES as readonly string[]).includes(activityType)) {
    return "invalid_activity";
  }
  const characterId = await getOrCreateCharacter(playerId, "Pilot");
  if (!(await ownsProxy(characterId, proxyId))) return "not_found";
  if (assigned) await assignProxy(characterId, activityType, proxyId);
  else await unassignProxy(characterId, activityType);
  return "ok";
}

export type ScrapResult =
  | { kind: "ok"; balance: string; credited: number }
  | { kind: "not_found" };

// Destroys the chassis (its slots and any assignments go with it — the
// gear that was installed stays in the player's inventory) and pays
// scrapValue(). Scrapping your last chassis is allowed: there's no free
// replacement (the starter chassis is granted once per player, see
// players.starter_chassis_granted), so a new one costs the full price. One
// SQL statement: the credit and ledger row only happen if the delete did.
export async function scrapChassis(
  playerId: string,
  proxyId: string,
): Promise<ScrapResult> {
  const characterId = await getOrCreateCharacter(playerId, "Pilot");
  if (!(await ownsProxy(characterId, proxyId))) return { kind: "not_found" };

  const slots =
    (await countSlots(proxyId, "standard")) +
    (await countSlots(proxyId, "carriage"));
  const credited = scrapValue(slots);

  const rows = await sql`
    with d as (
      delete from proxies
      where id = ${proxyId} and character_id = ${characterId}
      returning id
    ),
    p as (
      update players set balance = balance + ${credited}
      where id = ${playerId} and exists (select 1 from d)
      returning balance
    ),
    l as (
      insert into balance_transactions (player_id, reason, delta)
      select ${playerId}, 'chassis_scrap', ${credited} where exists (select 1 from d)
    )
    select balance from p
  `;
  if (rows.length === 0) return { kind: "not_found" };
  return { kind: "ok", balance: rows[0].balance as string, credited };
}

// --- field equipment (ore siphon, line scanner) ------------------------------

export type EquipmentTradeResult =
  | { kind: "ok"; balance: string }
  | { kind: "insufficient_funds" }
  | { kind: "insufficient_owned" }
  | { kind: "not_found" };

// Only items the Mechanic actually carries: category 'equipment' with
// 'mechanic' in its activity_types. Stops this endpoint being used to buy or
// sell arbitrary catalog items.
async function isMechanicEquipment(itemKey: string): Promise<boolean> {
  const [row] = await sql`
    select 1 as ok from item_catalog
    where item_key = ${itemKey} and active = true and category = 'equipment'
      and 'mechanic' = any(activity_types)
  `;
  return !!row;
}

export async function buyEquipment(
  playerId: string,
  siteId: string,
  itemKey: string,
  quantity: number,
): Promise<EquipmentTradeResult> {
  if (!(await isMechanicEquipment(itemKey))) return { kind: "not_found" };
  const r = await purchaseItem(playerId, itemKey, quantity, siteId);
  return r.kind === "ok" ? { kind: "ok", balance: r.balance } : r;
}

export async function sellEquipment(
  playerId: string,
  siteId: string,
  itemKey: string,
  quantity: number,
): Promise<EquipmentTradeResult> {
  if (!(await isMechanicEquipment(itemKey))) return { kind: "not_found" };
  const r = await sellItem(playerId, "extraction", itemKey, quantity, siteId);
  return r.kind === "ok" ? { kind: "ok", balance: r.balance } : r.kind === "not_sellable" ? { kind: "not_found" } : r;
}
