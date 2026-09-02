"use client";

import { useCallback } from "react";
import { CatalogScreen } from "../components/CatalogScreen";

const SURVEYOR_CATEGORIES = new Set(["license", "ore"]);

// Mineral licences and ore trading — split out from the general Mechanic
// store (see build-spec-ore-progression.md Stage 5/6 follow-up). Licences
// aren't sellable (see db/011_sell_prices.sql), so their cards just never
// show a Sell button; ore is both buyable and sellable here.
export default function SurveyorPage() {
  const categoryFilter = useCallback(
    (category: string) => SURVEYOR_CATEGORIES.has(category),
    [],
  );

  return (
    <CatalogScreen
      section="surveyor"
      headerLinks={[
        { href: "/games/mining/store", label: "Mechanic" },
        { href: "/games/mining/build", label: "Build" },
        { href: "/games/mining", label: "Back to run" },
      ]}
      categoryFilter={categoryFilter}
    />
  );
}
