// Pure category -> slot_type mapping, split out of lib/proxies.ts so
// client components (e.g. app/games/mining/build/page.tsx) can import the
// real rule directly instead of hand-rolling their own copy — lib/
// proxies.ts pulls in @/db/client, which has no business in a client
// bundle, so this file deliberately has zero imports of its own.
export type SlotType = "standard" | "carriage";

// Slots that hold custom/utility equipment rather than a normal build
// part — mining's field-tool consumables today, weapons once the arena
// adds them. Kept here (not per-game) since the carriage/standard split is
// meant to mean the same thing everywhere.
export const CARRIAGE_CATEGORIES = new Set(["equipment", "weapon"]);

// Never equippable at all, in any slot — capacity/unlock items and things
// that live in plain inventory instead of a chassis slot.
export const NON_EQUIPPABLE_CATEGORIES = new Set([
  "ore",
  "license",
  "expansion",
  "equipment_slot",
]);

export function categoryFitsSlot(category: string, slotType: SlotType): boolean {
  if (NON_EQUIPPABLE_CATEGORIES.has(category)) return false;
  return CARRIAGE_CATEGORIES.has(category) === (slotType === "carriage");
}
