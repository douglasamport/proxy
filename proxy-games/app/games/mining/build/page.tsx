"use client";

import { useMemo, useState } from "react";
import { CFG, fuelMult } from "@/lib/mining-engine";
import type { StatKey } from "@/lib/mining-engine";
import type { CatalogItem } from "@/lib/mining-inventory";
import { categoryIcon, FullBuildIcon } from "../icons";
import { GameHeader } from "@/app/games/mining/components/GameHeader";
import { FilterBar } from "@/app/games/mining/components/FilterBar";
import { EquipCard } from "@/app/games/mining/components/EquipCard";
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
const FULL_BUILD = "__full__";
const EQUIPMENT_CATEGORY = "equipment";

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
    slotTotal,
    equipmentSlotTotal,
    chassis,
    balance,
    load,
    equippedChassisTotal,
    equippedEquipmentTotal,
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

  const chassisSlotsLeft = slotTotal - equippedChassisTotal;
  const equipmentSlotsLeft = equipmentSlotTotal - equippedEquipmentTotal;

  const equippedByCategory = useMemo(() => {
    const byKey = new Map(catalog.map((c) => [c.item_key, c]));
    const totals = new Map<string, number>();
    for (const row of inventory) {
      const item = byKey.get(row.item_key);
      if (!item || row.equipped_quantity <= 0) continue;
      totals.set(
        item.category,
        (totals.get(item.category) ?? 0) + row.equipped_quantity,
      );
    }
    return totals;
  }, [catalog, inventory]);

  // Build only ever shows what's actually owned — an item you haven't
  // bought yet isn't something to equip, it's something to go buy (see the
  // Store). Full build narrows further, to what's currently equipped.
  const items = useMemo(() => {
    if (effectiveCategory === FULL_BUILD) {
      return catalog.filter(
        (c) => (invByKey.get(c.item_key)?.equipped_quantity ?? 0) > 0,
      );
    }
    return catalog.filter(
      (c) =>
        c.category === effectiveCategory &&
        (invByKey.get(c.item_key)?.owned_quantity ?? 0) > 0,
    );
  }, [catalog, effectiveCategory, invByKey]);

  async function setEquipped(itemKey: string, quantity: number) {
    setBusyKey(itemKey);
    setError("");
    const res = await fetch("/api/inventory/equip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_key: itemKey, quantity }),
    });
    setBusyKey(null);
    if (!res.ok) {
      setError(
        res.status === 400
          ? "Not enough owned, or that exceeds your slot cap."
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
    cat === EQUIPMENT_CATEGORY ? equipmentSlotsLeft : chassisSlotsLeft;

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
                  equippedQuantity={
                    invByKey.get(item.item_key)?.equipped_quantity ?? 0
                  }
                  roomLeft={roomLeftForCategory(item.category)}
                  busy={busyKey === item.item_key}
                  accent={accentForCategory(item.category)}
                  onEquippedChange={(next) => setEquipped(item.item_key, next)}
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
