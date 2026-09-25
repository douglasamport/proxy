"use client";

import { useMemo, useState } from "react";
import { CFG, fuelMult } from "@/lib/mining-engine";
import type { StatKey } from "@/lib/mining-engine";
import type { CatalogItem } from "@/lib/mining-inventory";
import { categoryFitsSlot } from "@/lib/slot-categories";
import type { SlotType } from "@/lib/slot-categories";
import { categoryIcon, FullBuildIcon } from "@/components/game-shell/icons";
import { GameHeader } from "@/components/game-shell/GameHeader";
import { FilterBar } from "@/components/game-shell/FilterBar";
import { EquipCard } from "@/components/EquipCard";
import { StatsPanel } from "@/app/games/mining/components/StatsPanel";
import { accentForCategory, ATOMS } from "@/lib/mining-theme";
import { useInventory } from "../layout";

// The dedicated chassis build screen. Separate from the per-run fitting
// flow on purpose: a loadout is now a pile of *owned* items (you might own
// 3 basic fuel cells and 1 boosted one), and equipping mixes and matches
// them — that only works as a master/detail browse, not a 7-row stepper.
// A filter bar picks the system (plus a pinned "Full build" option that
// shows everything equipped at once, across categories); below it, one
// EquipCard per owned item in that category. A stats panel on the side
// shows live chassis stats, recomputed after every equip change. What's
// equipped here is what the next run launches with (see FittingPanel's
// read-only Chassis section on the fitting page).
//
// "Equipped" is a real chassis_slots row now, not a quantity column (see
// lib/mining-inventory.ts and db/020_chassis_slots.sql) — EquipCard's
// one-box-per-owned-copy toggle is kept as the interaction (still the
// right shape for "click to fit/unfit"), but each click now resolves to a
// specific slot id: the first empty slot of the right type to fit one in,
// the first slot holding that item to pull one out of. Which physical
// slot a given copy lands in is otherwise not meaningful yet — that only
// starts to matter once slots can differ from each other (e.g. arena mount
// bonuses), at which point this screen would grow real per-slot pickers.
const FULL_BUILD = "__full__";

function slotTypeForCategory(category: string): SlotType {
  return categoryFitsSlot(category, "carriage") ? "carriage" : "standard";
}

function categoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// No real art yet for most items — a placeholder keeps the layout spot
// reserved so dropping in real image_url values later is a data change,
// not a UI one.
function imgSrc(item: CatalogItem): string {
  return (
    item.image_url ||
    `https://placehold.co/72x72/1B222B/54C6DC?text=${encodeURIComponent(item.label.slice(0, 2).toUpperCase())}`
  );
}

export default function BuildPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const {
    catalog,
    inventory,
    slots,
    chassis,
    balance,
    load,
  } = useInventory();

  // 'expansion' and 'equipment_slot' aren't equippable — they're one-time
  // capacity purchases (see the Store), not something to add/remove per
  // run, so neither gets a filter option here.

  const categories = useMemo(
    () =>
      Array.from(new Set(catalog.map((c) => c.category))).filter(
        (c) => c !== "expansion" && c !== "equipment_slot",
      ),
    [catalog],
  );

  // Default the selection to the first category once the catalog loads —
  // not a mirrored copy of state, just filling in "nothing picked yet".
  const effectiveCategory = selectedCategory ?? categories[0] ?? FULL_BUILD;

  const invByKey = useMemo(
    () => new Map(inventory.map((r) => [r.item_key, r])),
    [inventory],
  );

  // Installed count per item_key, and empty-slot count per slot_type —
  // both read straight off the real chassis_slots rows instead of a
  // separate equipped_quantity/slotTotal subtraction.
  const installedByItem = useMemo(() => {
    const totals = new Map<string, number>();
    for (const slot of slots) {
      if (!slot.installed_item_id) continue;
      totals.set(
        slot.installed_item_id,
        (totals.get(slot.installed_item_id) ?? 0) + 1,
      );
    }
    return totals;
  }, [slots]);

  const emptySlotsByType = useMemo(() => {
    const totals: Record<SlotType, number> = { standard: 0, carriage: 0 };
    for (const slot of slots) {
      if (!slot.installed_item_id) totals[slot.slot_type]++;
    }
    return totals;
  }, [slots]);

  const chassisSlotsLeft = emptySlotsByType.standard;
  const equipmentSlotsLeft = emptySlotsByType.carriage;

  const equippedByCategory = useMemo(() => {
    const byKey = new Map(catalog.map((c) => [c.item_key, c]));
    const totals = new Map<string, number>();
    for (const [itemKey, count] of installedByItem) {
      const item = byKey.get(itemKey);
      if (!item) continue;
      totals.set(item.category, (totals.get(item.category) ?? 0) + count);
    }
    return totals;
  }, [catalog, installedByItem]);

  const equippedChassisTotal = slots.filter(
    (s) => s.slot_type === "standard" && s.installed_item_id,
  ).length;
  const equippedEquipmentTotal = slots.filter(
    (s) => s.slot_type === "carriage" && s.installed_item_id,
  ).length;

  // Build only ever shows what's actually owned — an item you haven't
  // bought yet isn't something to equip, it's something to go buy (see the
  // Store). Full build narrows further, to what's currently equipped.
  const items = useMemo(() => {
    if (effectiveCategory === FULL_BUILD) {
      return catalog.filter((c) => (installedByItem.get(c.item_key) ?? 0) > 0);
    }
    return catalog.filter(
      (c) =>
        c.category === effectiveCategory &&
        (invByKey.get(c.item_key)?.owned_quantity ?? 0) > 0,
    );
  }, [catalog, effectiveCategory, invByKey, installedByItem]);

  async function equipOne(item: CatalogItem) {
    const slotType = slotTypeForCategory(item.category);
    const target = slots.find(
      (s) => s.slot_type === slotType && !s.installed_item_id,
    );
    if (!target) {
      setError("No free slot for that item.");
      return;
    }
    await postSlot(item.item_key, target.id, item.item_key);
  }

  async function unequipOne(item: CatalogItem) {
    const target = slots.find((s) => s.installed_item_id === item.item_key);
    if (!target) return;
    await postSlot(item.item_key, target.id, null);
  }

  async function postSlot(
    busyItemKey: string,
    slotId: string,
    itemKey: string | null,
  ) {
    setBusyKey(busyItemKey);
    setError("");
    const res = await fetch("/api/inventory/equip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot_id: slotId, item_key: itemKey }),
    });
    setBusyKey(null);
    if (!res.ok) {
      setError(
        res.status === 400
          ? "Not enough owned, or that item doesn't fit this slot."
          : "Could not update loadout — try again.",
      );
      return;
    }
    await load();
  }

  // if (authRequired) {
  //   return (
  //     <div className={`min-h-screen ${ATOMS.bgVoid}`}>
  //       <GameHeader section="build" links={[{ href: '/games/mining', label: 'Back to run' }]} />
  //       <main className="mx-auto max-w-xl px-6 py-16 text-center">
  //         <p className={`text-sm ${ATOMS.textDim}`}>Your chassis loadout is tied to your account.</p>
  //         <a href="/login" className={`mt-4 inline-block rounded px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider ${ATOMS.textVoid} ${ACCENTS.equipment.btn}`}>
  //           Sign in
  //         </a>
  //       </main>
  //     </div>
  //   );
  // }

  const mult = fuelMult(chassis);
  const statRows = [
    { label: "Hold per trip", value: `${chassis.hold}u` },
    { label: "Fuel capacity", value: chassis.fuelCap.toFixed(0) },
    {
      label: "Dig a fresh cell",
      value: ((1 / chassis.speed + CFG.DIG_FUEL) * mult).toFixed(2),
    },
    {
      label: "Drive a tunnel",
      value: ((1 / chassis.speed) * CFG.TUNNEL_MULT * mult).toFixed(2),
    },
    {
      label: "Turn surcharge",
      value: ((CFG.TURN_BASE / chassis.movement) * mult).toFixed(2),
    },
    {
      label: "Fresh digs available",
      value: `~${Math.floor(chassis.fuelCap / ((1 / chassis.speed + CFG.DIG_FUEL) * mult))}`,
    },
    { label: "Sink", value: String(chassis.sinkCap) },
    { label: "Ping range", value: `${chassis.sensorRange.toFixed(1)} cells` },
    { label: "Fix accuracy", value: `±${chassis.sensorBlur.toFixed(1)}` },
    { label: "Ping cost", value: `${chassis.pingFuel.toFixed(1)} fuel` },
    {
      label: "Grade estimate",
      value: `±${(chassis.analyser / 2).toFixed(1)} tiers`,
    },
  ];

  const roomLeftForCategory = (cat: string) =>
    categoryFitsSlot(cat, "carriage") ? equipmentSlotsLeft : chassisSlotsLeft;

  return (
    <div className={`min-h-screen ${ATOMS.bgVoid}`}>
      {/* <GameHeader
        section="build"
        stats={[
          { label: "slots", value: `${equippedChassisTotal} / ${slotTotal}` },
          {
            label: "equipment",
            value: `${equippedEquipmentTotal} / ${equipmentSlotTotal}`,
          },
          { label: "balance", value: balance ?? "—" },
        ]}
        links={[
          { href: "/games/mining/store", label: "Mechanic" },
          { href: "/games/mining/surveyor", label: "Surveyor" },
          { href: "/games/mining", label: "Back to run" },
        ]}
      /> */}

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <div className={`mb-4 text-sm ${ATOMS.textDanger}`}>{error}</div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
          <div>
            <FilterBar
              legend="system"
              value={effectiveCategory}
              onChange={setSelectedCategory}
              options={[
                {
                  value: FULL_BUILD,
                  label: "Full build",
                  Icon: FullBuildIcon,
                  count: equippedChassisTotal + equippedEquipmentTotal,
                },
                ...categories.map((cat) => ({
                  value: cat,
                  label: categoryLabel(cat),
                  Icon: categoryIcon(cat),
                  count: equippedByCategory.get(cat) ?? 0,
                })),
              ]}
            />

            <p className={`mb-4 text-[11px] ${ATOMS.textDim}`}>
              {effectiveCategory === FULL_BUILD
                ? `${chassisSlotsLeft} chassis / ${equipmentSlotsLeft} equipment slot${equipmentSlotsLeft === 1 ? "" : "s"} free`
                : (() => {
                    const left = roomLeftForCategory(effectiveCategory);
                    return `${left} slot${left === 1 ? "" : "s"} free`;
                  })()}
            </p>

            {items.length === 0 && (
              <p className={`text-sm ${ATOMS.textDim}`}>
                {effectiveCategory === FULL_BUILD ? (
                  "Nothing fitted yet."
                ) : (
                  <>
                    You don&rsquo;t own anything in this category yet — visit
                    the{" "}
                    <a href="/games/mining/store" className={ATOMS.textTeal}>
                      mechanic
                    </a>
                    .
                  </>
                )}
              </p>
            )}

            <div className="space-y-3">
              {items.map((item) => (
                <EquipCard
                  key={item.item_key}
                  label={item.label}
                  description={item.description}
                  effects={
                    Object.keys(item.effects).length
                      ? effectsText(item.effects)
                      : null
                  }
                  imageSrc={imgSrc(item)}
                  ownedQuantity={
                    invByKey.get(item.item_key)?.owned_quantity ?? 0
                  }
                  equippedQuantity={installedByItem.get(item.item_key) ?? 0}
                  roomLeft={roomLeftForCategory(item.category)}
                  busy={busyKey === item.item_key}
                  accent={accentForCategory(item.category)}
                  onEquippedChange={(next) =>
                    next > (installedByItem.get(item.item_key) ?? 0)
                      ? equipOne(item)
                      : unequipOne(item)
                  }
                />
              ))}
            </div>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <StatsPanel title="Chassis stats" rows={statRows} />
          </div>
        </div>
      </main>
    </div>
  );
}

function effectsText(effects: Partial<Record<StatKey, number>>): string {
  return Object.entries(effects)
    .map(([k, v]) => `${(v ?? 0) > 0 ? "+" : ""}${v} ${k}`)
    .join("  ");
}
