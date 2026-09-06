"use client";

import { useCallback } from "react";
import { CatalogScreen } from "@/components/game-shell/CatalogScreen";

// Furnace/vat/cooler/heater/radiator/valve parts (db/015, db/016, db/017)
// plus every mineral's refined output, shown here so a player can see what
// a finished good is worth without leaving the store — it's sellable but
// never buyable (cost 0), so its Acquire button is simply always disabled
// by the funds check with nothing extra needed. 'consumable' is the
// Coolant Flush (db/016); 'decanter_unlock' is the Auto-Decanter (db/017).
const REFINE_STORE_CATEGORIES = new Set([
  "furnace",
  "vat",
  "cooler",
  "heater",
  "radiator",
  "valve",
  "refined",
  "consumable",
  "decanter_unlock",
]);

export default function RefineStorePage() {
  const categoryFilter = useCallback(
    (category: string) => REFINE_STORE_CATEGORIES.has(category),
    [],
  );

  return <CatalogScreen game="refine" categoryFilter={categoryFilter} />;
}
