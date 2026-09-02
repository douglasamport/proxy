"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StatKey } from "@/lib/mining-engine";
import type { CatalogItem, InventoryRow } from "@/lib/mining-inventory";
import { categoryIcon } from "../icons";
import { ItemCard } from "@/app/games/mining/components/ItemCard";
import {
  categoryOptions,
  FilterBar,
} from "@/app/games/mining/components/FilterBar";
import { GameHeader } from "@/app/games/mining/components/GameHeader";
import { SellQuantityModal } from "./SellQuantityModal";
import { accentForCategory, ACCENTS, ATOMS } from "@/lib/mining-theme";
import { useInventory } from "../layout";

// Not imported as a value from lib/mining-inventory.ts — that module pulls
// in the DB client, which has no business in a client bundle. Just string
// keys, duplicated here the same way 'mining' (the game slug) is.
const EXPANSION_KEY = "chassis_expansion";
const EQUIPMENT_SLOT_KEY = "equipment_slot_unlock";
const ORE_CATEGORY = "ore";
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

function effectsText(effects: Partial<Record<StatKey, number>>): string {
  return Object.entries(effects)
    .map(([k, v]) => `${(v ?? 0) > 0 ? "+" : ""}${v} ${k}`)
    .join("  ");
}

// Shared shell for both catalog screens (the general Mechanic store and the
// mineral-licence/ore Surveyor) — same load/buy/sell plumbing and card
// rendering, differing only in which categories they show and whether
// buying is allowed for a given item (see build-spec-ore-progression.md,
// Stage 5/6 follow-up: ore trading moved to its own dedicated screen).
export interface CatalogScreenProps {
  categoryFilter: (category: string) => boolean;
  buyDisabledReason?: (item: CatalogItem) => string | undefined;
}

export function CatalogScreen({
  categoryFilter,
  buyDisabledReason,
}: CatalogScreenProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>(ALL);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [sellBusyKey, setSellBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  // The item currently in the sell-quantity modal, if any — set by an
  // ItemCard's Sell click, cleared on cancel or once the sale completes.
  const [sellTarget, setSellTarget] = useState<{
    item_key: string;
    label: string;
    sellValue: number;
    maxQuantity: number;
  } | null>(null);

  const { catalog, inventory, balance, load } = useInventory();

  const ownedByKey = new Map(
    inventory.map((r) => [r.item_key, r.owned_quantity]),
  );
  const equippedByKey = new Map(
    inventory.map((r) => [r.item_key, r.equipped_quantity]),
  );
  const funds = balance ? Number(balance) : 0;

  const visibleCatalog = useMemo(
    () => catalog.filter((c) => categoryFilter(c.category)),
    [catalog, categoryFilter],
  );
  const categories = useMemo(
    () => Array.from(new Set(visibleCatalog.map((c) => c.category))),
    [visibleCatalog],
  );
  const shown = useMemo(
    () =>
      filter === ALL
        ? visibleCatalog
        : visibleCatalog.filter((c) => c.category === filter),
    [visibleCatalog, filter],
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

  async function sell(itemKey: string, quantity: number) {
    setSellBusyKey(itemKey);
    setError("");
    const res = await fetch("/api/store/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "mining", item_key: itemKey, quantity }),
    });
    setSellBusyKey(null);
    if (!res.ok) {
      setError(
        res.status === 409
          ? "Nothing unequipped left to sell."
          : "Could not complete sale — try again.",
      );
      return;
    }
    setSellTarget(null);
    await load();
    router.refresh();
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

  // if (authRequired) {
  //   return (
  //     <div className={`min-h-screen ${ATOMS.bgVoid}`}>
  //       <GameHeader section={section} links={[{ href: "/games/mining", label: "Back to run" }]} />
  //       <main className="mx-auto max-w-xl px-6 py-16 text-center">
  //         <p className={`text-sm ${ATOMS.textDim}`}>This screen is tied to your account balance.</p>
  //         <a href="/login" className={`mt-4 inline-block rounded px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider ${ATOMS.textVoid} ${ACCENTS.equipment.btn}`}>
  //           Sign in
  //         </a>
  //       </main>
  //     </div>
  //   );
  // }

  return (
    <div className={`min-h-screen ${ATOMS.bgVoid}`}>
      {/* <GameHeader
        section={section}
        stats={[{ label: "balance", value: balance ?? "—" }]}
        links={headerLinks}
      /> */}

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <div className={`mb-4 text-sm ${ATOMS.textDanger}`}>{error}</div>
        )}

        <FilterBar
          legend="filter"
          options={categoryOptions(categories, ALL, categoryIcon)}
          value={filter}
          onChange={setFilter}
        />

        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => {
            const owned = ownedByKey.get(item.item_key) ?? 0;
            const equipped = equippedByKey.get(item.item_key) ?? 0;
            const isExpansion = item.category === "expansion";
            // Only the literal one-time unlock item — NOT the whole
            // 'equipment' category. Ore siphon and line scanner live in
            // 'equipment' too, but they're ordinary repeat-buy consumables
            // (see lib/mining-inventory.ts's EQUIPMENT_SLOT_KEY vs
            // EQUIPMENT_CATEGORY); conflating the two here used to disable
            // the buy button — and route the purchase to the wrong
            // endpoint — after the first ore siphon/line scanner purchase.
            const isEquipmentSlotUnlock = item.category === "equipment_slot";
            // Per-mineral licences (see db/013_mineral_licences.sql, renamed
            // in db/014) — same one-time-gate display as the equipment bay
            // unlock above, just one row per mineral instead of a single row.
            const isLicense = item.category === "license";
            const alreadyOwned =
              (isEquipmentSlotUnlock || isLicense) && owned >= 1;
            const cost = isExpansion
              ? Number(item.cost) * 2 ** owned
              : Number(item.cost);

            const sellableQuantity = owned - equipped;
            const sellValue =
              item.sellable && item.sell_value != null
                ? item.category === ORE_CATEGORY
                  ? Number(item.sell_value)
                  : cost * Number(item.sell_value)
                : undefined;

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
                accent={accentForCategory(item.category, item.item_key)}
                buyDisabledReason={buyDisabledReason?.(item)}
                sellValue={sellValue}
                sellQuantity={sellableQuantity}
                onSell={() =>
                  sellValue !== undefined &&
                  setSellTarget({
                    item_key: item.item_key,
                    label: item.label,
                    sellValue,
                    maxQuantity: sellableQuantity,
                  })
                }
                sellBusy={sellBusyKey === item.item_key}
                statusValue={
                  isExpansion
                    ? String(owned)
                    : isEquipmentSlotUnlock || isLicense
                      ? alreadyOwned
                        ? "✓"
                        : "—"
                      : String(owned)
                }
                statusCaption={
                  isExpansion
                    ? "slots added"
                    : isEquipmentSlotUnlock || isLicense
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

      {sellTarget && (
        <SellQuantityModal
          label={sellTarget.label}
          sellValue={sellTarget.sellValue}
          maxQuantity={sellTarget.maxQuantity}
          busy={sellBusyKey === sellTarget.item_key}
          onConfirm={(quantity) => sell(sellTarget.item_key, quantity)}
          onCancel={() => setSellTarget(null)}
        />
      )}
    </div>
  );
}
