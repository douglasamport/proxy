"use client";

import { CatalogScreen } from "@/components/game-shell/CatalogScreen";

// Everything except 'scrap' is browsable/buyable here — scrap only ever
// comes from salvage, never a purchase (see db/020_land_clearing_catalog.sql).
export default function LandClearingStorePage() {
  return (
    <CatalogScreen
      game="land_clearing"
      categoryFilter={(category) => category !== "scrap"}
      sellPath="/api/expand/inventory/sell"
      doublingPriceEndpoints={{
        expansion: "/api/store/expand",
        weapon_mount: "/api/expand/inventory/weapon-mount",
      }}
    />
  );
}
