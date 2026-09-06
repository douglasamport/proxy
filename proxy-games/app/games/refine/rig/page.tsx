"use client";

import { useMemo, useState } from "react";
import { useInventory } from "@/components/game-shell/InventoryContext";
import { ATOMS, SURFACE, ACCENTS, accentForCategory } from "@/lib/mining-theme";
import type { CatalogItem } from "@/lib/mining-inventory";
import { PART_CATEGORIES } from "@/lib/refine-engine";
import type { PartCategory } from "@/lib/refine-engine";

const CATEGORY_LABEL: Record<PartCategory, string> = {
  furnace: "Furnace",
  vat: "Vat",
  cooler: "Cooling coils (vat → sink)",
  heater: "Vat heater",
  radiator: "Radiator (sink → ambient)",
  valve: "Vent valve",
};

function effectsText(effects: Partial<Record<string, number>>): string {
  return Object.entries(effects)
    .map(([k, v]) => `${(v ?? 0) > 0 ? "+" : ""}${v} ${k}`)
    .join("  ");
}

// The refine equivalent of mining's Build screen — but the mechanic here is
// "pick one active item per category" (furnace/vat/cooler), not stacking
// multiple items into a shared slot pool, so this is its own simple
// radio-style picker rather than a reuse of EquipCard/the Build layout.
// Buying happens on the Store; this only decides which owned part is
// installed. See setActivePart() in lib/refine-inventory.ts.
export default function RigPage() {
  const { catalog, inventory, load } = useInventory();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const invByKey = useMemo(
    () => new Map(inventory.map((r) => [r.item_key, r])),
    [inventory],
  );

  const byCategory = useMemo(() => {
    const map = new Map<PartCategory, CatalogItem[]>();
    for (const cat of PART_CATEGORIES) {
      map.set(
        cat,
        catalog.filter(
          (c) =>
            c.category === cat &&
            (invByKey.get(c.item_key)?.owned_quantity ?? 0) > 0,
        ),
      );
    }
    return map;
  }, [catalog, invByKey]);

  const activeItem = (cat: PartCategory) =>
    (byCategory.get(cat) ?? []).find(
      (c) => (invByKey.get(c.item_key)?.equipped_quantity ?? 0) > 0,
    );

  async function activate(category: PartCategory, itemKey: string) {
    setBusyKey(itemKey);
    setError("");
    const res = await fetch("/api/refine/equip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, item_key: itemKey }),
    });
    setBusyKey(null);
    if (!res.ok) {
      setError("Could not activate that part — try again.");
      return;
    }
    await load();
  }

  const rigEffects: Partial<Record<string, number>> = {};
  for (const cat of PART_CATEGORIES) {
    const item = activeItem(cat);
    if (!item) continue;
    for (const [k, v] of Object.entries(item.effects)) {
      rigEffects[k] = (rigEffects[k] ?? 0) + (v ?? 0);
    }
  }

  return (
    <main className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[1fr_260px]">
      <div>
        {error && (
          <div className={`mb-4 text-sm ${ATOMS.textDanger}`}>{error}</div>
        )}

        <div className="space-y-8">
          {PART_CATEGORIES.map((cat) => {
            const items = byCategory.get(cat) ?? [];
            const active = activeItem(cat);
            return (
              <section key={cat}>
                <div className={`${SURFACE.label} mb-2`}>
                  {CATEGORY_LABEL[cat]}
                </div>
                {items.length === 0 ? (
                  <p className={`text-sm ${ATOMS.textDim}`}>
                    You don&rsquo;t own a {CATEGORY_LABEL[cat].toLowerCase()}{" "}
                    yet — visit the{" "}
                    <a href="/games/refine/store" className={ATOMS.textTeal}>
                      store
                    </a>
                    .
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((item) => {
                      const isActive = active?.item_key === item.item_key;
                      const accent = ACCENTS[accentForCategory(item.category)];
                      return (
                        <button
                          key={item.item_key}
                          onClick={() => activate(cat, item.item_key)}
                          disabled={isActive || busyKey === item.item_key}
                          className={`rounded-lg border p-4 text-left transition ${SURFACE.card} ${
                            isActive
                              ? accent.border
                              : `${ATOMS.borderLine} hover:border-white/20`
                          }`}
                        >
                          <div
                            className={`text-sm font-bold uppercase tracking-wide ${
                              isActive ? accent.text : ATOMS.textPrimary
                            }`}
                          >
                            {item.label}
                          </div>
                          <div className={`mt-1 text-[11px] ${ATOMS.textDim}`}>
                            {item.description}
                          </div>
                          {Object.keys(item.effects).length > 0 && (
                            <div
                              className={`mt-2 font-mono text-[10px] uppercase tracking-wider ${ATOMS.textMuted}`}
                            >
                              {effectsText(item.effects)}
                            </div>
                          )}
                          <div
                            className={`mt-3 font-mono text-[10px] font-bold uppercase tracking-wider ${
                              isActive ? accent.text : ATOMS.textDim
                            }`}
                          >
                            {isActive
                              ? "Active"
                              : busyKey === item.item_key
                                ? "…"
                                : "Activate"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className={`rounded-lg ${SURFACE.card} p-4`}>
          <div className={SURFACE.label}>Rig stats</div>
          <div
            className={`mt-3 space-y-1.5 border-t ${ATOMS.borderInset} pt-3`}
          >
            {Object.entries(rigEffects).length === 0 ? (
              <p className={`text-[11px] ${ATOMS.textDim}`}>
                No parts activated yet.
              </p>
            ) : (
              Object.entries(rigEffects).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-3 text-[11px]"
                >
                  <span className={ATOMS.textDim}>{k}</span>
                  <span
                    className={`font-mono font-bold ${ATOMS.textPrimary}`}
                  >
                    {v}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
