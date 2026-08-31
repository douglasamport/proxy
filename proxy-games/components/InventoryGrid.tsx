"use client";

import { useMemo, useState } from "react";
import { categoryIcon } from "@/app/games/mining/icons";
import { InventoryCard } from "@/components/InventoryCard";
import { categoryOptions, FilterBar } from "@/components/FilterBar";
import { accentForCategory } from "@/lib/mining-theme";

export interface OwnedItem {
  item_key: string;
  category: string;
  label: string;
  description: string | null;
  image_url: string | null;
  owned_quantity: number;
  equipped_quantity: number;
}

const ALL = "__all__";

function imgSrc(item: OwnedItem): string {
  return (
    item.image_url ||
    `https://placehold.co/120x120?text=${encodeURIComponent(item.label.slice(0, 2).toUpperCase())}`
  );
}

// Client-only for the category filter bar — the page itself stays a server
// component for the auth-gated data fetch (see app/inventory/page.tsx).
export function InventoryGrid({ items }: { items: OwnedItem[] }) {
  const [filter, setFilter] = useState<string>(ALL);
  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category))),
    [items],
  );
  const shown =
    filter === ALL ? items : items.filter((i) => i.category === filter);

  return (
    <>
      <FilterBar
        legend="filter"
        options={categoryOptions(categories, ALL, categoryIcon)}
        value={filter}
        onChange={setFilter}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {shown.map((item) => {
          const isExpansion = item.category === "expansion";
          // Only the one-time unlock item, not the whole 'equipment'
          // category — ore siphon and line scanner are ordinary
          // owned/equipped consumables and should show numeric counts, not
          // the unlock item's locked/unlocked toggle. See the matching
          // comment in app/games/mining/store/page.tsx.
          const isEquipmentSlot = item.category === "equipment_slot";

          return (
            <InventoryCard
              key={item.item_key}
              label={item.label}
              category={item.category}
              description={item.description}
              imageSrc={imgSrc(item)}
              ownedQuantity={item.owned_quantity}
              equippedQuantity={item.equipped_quantity}
              isExpansion={isExpansion}
              isEquipmentSlot={isEquipmentSlot}
              accent={accentForCategory(item.category)}
            />
          );
        })}
      </div>
    </>
  );
}
