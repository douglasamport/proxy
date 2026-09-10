"use client";

import { useMemo, useState } from "react";
import type { Chassis, StatKey } from "@/lib/land-clearing-engine";
import type { CatalogItem } from "@/lib/land-clearing-inventory";
import { categoryIcon, FullBuildIcon } from "@/components/game-shell/icons";
import { FilterBar } from "@/components/game-shell/FilterBar";
import { EquipCard } from "@/app/games/expand/components/EquipCard";
import { accentForCategory, ATOMS } from "@/lib/mining-theme";
import { useInventory } from "../layout";

const FULL_BUILD = "__full__";
// Mirrors WEAPON_CATEGORIES in lib/land-clearing-inventory.ts — weapons
// draw from the separate weapon_mounts pool, not the general chassis gear
// pool, so the build screen needs to know which categories those are to
// show the right cap per item (see roomLeftForCategory below).
const WEAPON_CATEGORIES = new Set(["weapon", "ranged", "aoe"]);

function categoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function imgSrc(item: CatalogItem): string {
  return (
    item.image_url ||
    `https://placehold.co/72x72/1B222B/54C6DC?text=${encodeURIComponent(item.label.slice(0, 2).toUpperCase())}`
  );
}

function effectsText(effects: Partial<Record<StatKey, number>>): string {
  return Object.entries(effects)
    .map(([k, v]) => `${(v ?? 0) > 0 ? "+" : ""}${v} ${k}`)
    .join("  ");
}

// Land-clearing's build screen — same master/detail shape as mining's, cut
// down since there's no separate equipment pool here: every non-scrap,
// non-expansion category is chassis gear, one shared slot pool.
export default function LandClearingBuildPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const inv = useInventory();
  const {
    catalog,
    inventory,
    slotTotal,
    equipmentSlotTotal: weaponMountTotal,
    load,
    equippedChassisTotal,
    equippedEquipmentTotal: equippedWeaponTotal,
  } = inv;
  // useInventory()'s `chassis` field is typed for mining/refine (see
  // components/game-shell/InventoryContext.tsx) — the actual object here is
  // whatever GET /api/expand/inventory returned, land-clearing's own
  // shape. Cast at the one place this component reads it.
  const chassis = inv.chassis as unknown as Chassis;

  const categories = useMemo(
    () =>
      Array.from(new Set(catalog.map((c) => c.category))).filter(
        (c) => c !== "expansion" && c !== "scrap" && c !== "weapon_mount",
      ),
    [catalog],
  );

  const effectiveCategory = selectedCategory ?? categories[0] ?? FULL_BUILD;

  const invByKey = useMemo(
    () => new Map(inventory.map((r) => [r.item_key, r])),
    [inventory],
  );

  const slotsLeft = slotTotal - equippedChassisTotal;
  const weaponMountsLeft = weaponMountTotal - equippedWeaponTotal;
  const roomLeftForCategory = (category: string) =>
    WEAPON_CATEGORIES.has(category) ? weaponMountsLeft : slotsLeft;

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
    const res = await fetch("/api/expand/inventory/equip", {
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

  const chassisStats = [
    { label: "Armor", value: chassis.armor?.toFixed(0) ?? "0" },
    { label: "Speed (cheaper moves)", value: chassis.speed?.toFixed(2) ?? "0" },
    { label: "Tiles per move", value: chassis.movement?.toFixed(1) ?? "1" },
    { label: "Vision radius", value: chassis.vision?.toFixed(0) ?? "0" },
    {
      label: "Salvage yield bonus",
      value: `+${((chassis.salvageYield ?? 0) * 100).toFixed(0)}%`,
    },
  ];

  return (
    <div className={`min-h-screen ${ATOMS.bgVoid}`}>
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
                  count: equippedChassisTotal + equippedWeaponTotal,
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
                ? `${slotsLeft} chassis / ${weaponMountsLeft} weapon mount${weaponMountsLeft === 1 ? "" : "s"} free`
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
                    <a
                      href="/games/expand/store"
                      className={ATOMS.textTeal}
                    >
                      store
                    </a>
                    .
                  </>
                )}
              </p>
            )}

            <div className="space-y-3">
              {items.map((item) => {
                const row = invByKey.get(item.item_key);
                return (
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
                    ownedQuantity={row?.owned_quantity ?? 0}
                    equippedQuantity={row?.equipped_quantity ?? 0}
                    roomLeft={roomLeftForCategory(item.category)}
                    busy={busyKey === item.item_key}
                    accent={accentForCategory(item.category, item.item_key)}
                    onEquippedChange={(next) =>
                      setEquipped(item.item_key, next)
                    }
                  />
                );
              })}
            </div>
          </div>

          <aside className="space-y-4">
            <div>
              <h2
                className={`mb-2 text-[11px] font-bold uppercase tracking-wider ${ATOMS.textDim}`}
              >
                Weapons ({equippedWeaponTotal} / {weaponMountTotal} mounted)
              </h2>
              <div className="space-y-1.5">
                {(chassis.weapons ?? []).map((w, i) => (
                  <div key={i} className="text-sm">
                    <span className={ATOMS.textPrimary}>
                      {w.attack} atk · {w.range} range
                      {w.aoeRadius > 0 ? ` · AoE ${w.aoeRadius}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2
                className={`mb-2 text-[11px] font-bold uppercase tracking-wider ${ATOMS.textDim}`}
              >
                Chassis stats
              </h2>
              {chassisStats.map((s) => (
                <div key={s.label} className="flex justify-between text-sm">
                  <span className={ATOMS.textDim}>{s.label}</span>
                  <span className={ATOMS.textPrimary}>{s.value}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
