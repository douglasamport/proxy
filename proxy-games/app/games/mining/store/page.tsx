"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StatKey } from "@/lib/mining-engine";
import type { CatalogItem, InventoryRow } from "@/lib/mining-inventory";
import { categoryIcon } from "../icons";
import { ItemCard } from "@/components/ItemCard";
import { categoryOptions, FilterBar } from "@/components/FilterBar";
import { GameHeader } from "@/components/GameHeader";
import { accentForCategory, ACCENTS, ATOMS } from "@/lib/mining-theme";

// Not imported as a value from lib/mining-inventory.ts — that module pulls
// in the DB client, which has no business in a client bundle. It's just a
// string key, duplicated here the same way 'mining' (the game slug) is.
const EXPANSION_KEY = "chassis_expansion";
const EQUIPMENT_SLOT_KEY = "equipment_slot_unlock";
const ALL = "__all__";

// No real art yet for most items — a placeholder keeps the layout spot
// reserved so dropping in real image_url values later is a data change,
// not a UI one.
function imgSrc(item: CatalogItem): string {
  return (
    item.image_url ||
    `https://placehold.co/72x72/1B222B/54C6DC?text=${encodeURIComponent(item.label.slice(0, 2).toUpperCase())}`
  );
}

// Buy inventory here; equip it on the build screen. Kept as two screens
// (not folded together) because owning and fitting are different
// decisions — you might stockpile items you don't equip yet.
export default function StorePage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [filter, setFilter] = useState<string>(ALL);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/inventory?game=mining");
    if (!res.ok) {
      if (res.status === 401) setAuthRequired(true);
      return;
    }
    setAuthRequired(false);
    const data = await res.json();
    setCatalog(data.catalog);
    setInventory(data.inventory);
    setBalance(data.balance);
  }, []);

  const didLoadRef = useRef(false);
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    load();
  }, [load]);

  const ownedByKey = new Map(
    inventory.map((r) => [r.item_key, r.owned_quantity]),
  );
  const funds = balance ? Number(balance) : 0;

  const categories = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.category))),
    [catalog],
  );
  const shown = useMemo(
    () =>
      filter === ALL ? catalog : catalog.filter((c) => c.category === filter),
    [catalog, filter],
  );

  async function buy(itemKey: string) {
    setBusyKey(itemKey);
    setError("");
    const res = await fetch("/api/store/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "mining", item_key: itemKey, quantity: 1 }),
    });
    setBusyKey(null);
    if (!res.ok) {
      setError(
        res.status === 402
          ? "Not enough balance for that."
          : "Could not complete purchase — try again.",
      );
      return;
    }
    await load();
    router.refresh(); // balance changed — refresh the header's server-rendered figure
  }

  // Separate from buy(): price isn't flat here, it doubles with each one
  // already owned, so it hits its own endpoint (see /api/store/expand).
  async function buyExpansion() {
    setBusyKey(EXPANSION_KEY);
    setError("");
    const res = await fetch("/api/store/expand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "mining" }),
    });
    setBusyKey(null);
    if (!res.ok) {
      setError(
        res.status === 402
          ? "Not enough balance for that."
          : "Could not complete purchase — try again.",
      );
      return;
    }
    await load();
    router.refresh();
  }

  // One-time only, unlike the expansion above — see /api/store/equipment-slot.
  async function buyEquipmentSlot() {
    setBusyKey(EQUIPMENT_SLOT_KEY);
    setError("");
    const res = await fetch("/api/store/equipment-slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "mining" }),
    });
    setBusyKey(null);
    if (!res.ok) {
      setError(
        res.status === 402
          ? "Not enough balance for that."
          : "Could not complete purchase — try again.",
      );
      return;
    }
    await load();
    router.refresh();
  }

  if (authRequired) {
    return (
      <div className={`min-h-screen ${ATOMS.bgVoid}`}>
        <GameHeader section="store" links={[{ href: "/games/mining", label: "Back to run" }]} />
        <main className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className={`text-sm ${ATOMS.textDim}`}>The store is tied to your account balance.</p>
          <a href="/login" className={`mt-4 inline-block rounded px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider ${ATOMS.textVoid} ${ACCENTS.equipment.btn}`}>
            Sign in
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${ATOMS.bgVoid}`}>
      <GameHeader
        section="store"
        stats={[{ label: "balance", value: balance ?? "—" }]}
        links={[
          { href: "/games/mining/build", label: "Build" },
          { href: "/games/mining", label: "Back to run" },
        ]}
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && <div className={`mb-4 text-sm ${ATOMS.textDanger}`}>{error}</div>}

        <FilterBar
          legend="filter"
          options={categoryOptions(categories, ALL, categoryIcon)}
          value={filter}
          onChange={setFilter}
        />

        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => {
            const owned = ownedByKey.get(item.item_key) ?? 0;
            const isExpansion = item.category === "expansion";
            // Only the literal one-time unlock item — NOT the whole
            // 'equipment' category. Ore siphon and line scanner live in
            // 'equipment' too, but they're ordinary repeat-buy consumables
            // (see lib/mining-inventory.ts's EQUIPMENT_SLOT_KEY vs
            // EQUIPMENT_CATEGORY); conflating the two here used to disable
            // the buy button — and route the purchase to the wrong
            // endpoint — after the first ore siphon/line scanner purchase.
            const isEquipmentSlotUnlock = item.category === "equipment_slot";
            const alreadyOwned = isEquipmentSlotUnlock && owned >= 1;
            const cost = isExpansion
              ? Number(item.cost) * 2 ** owned
              : Number(item.cost);

            return (
              <ItemCard
                key={item.item_key}
                label={item.label}
                description={item.description}
                effects={
                  Object.keys(item.effects).length
                    ? effectsText(item.effects)
                    : null
                }
                imageSrc={imgSrc(item)}
                cost={cost}
                funds={funds}
                owned={alreadyOwned}
                busy={busyKey === item.item_key}
                accent={accentForCategory(item.category)}
                statusValue={
                  isExpansion
                    ? String(owned)
                    : isEquipmentSlotUnlock
                      ? alreadyOwned
                        ? "✓"
                        : "—"
                      : String(owned)
                }
                statusCaption={
                  isExpansion
                    ? "slots added"
                    : isEquipmentSlotUnlock
                      ? alreadyOwned
                        ? "unlocked"
                        : "locked"
                      : "owned"
                }
                onBuy={() =>
                  isExpansion
                    ? buyExpansion()
                    : isEquipmentSlotUnlock
                      ? buyEquipmentSlot()
                      : buy(item.item_key)
                }
              />
            );
          })}
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
