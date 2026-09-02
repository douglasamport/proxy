"use client";

import { useCallback } from "react";
import type { CatalogItem } from "@/lib/mining-inventory";
import { CatalogScreen } from "../components/CatalogScreen";

const ORE_CATEGORY = "ore";

// Buy inventory here; equip it on the build screen. Kept as two screens
// (not folded together) because owning and fitting are different
// decisions — you might stockpile items you don't equip yet.
//
// Ore trading (and mineral licences) moved to the dedicated Surveyor screen
// — ore still shows up here (nothing about the general catalog listing
// changes), but buying it is disabled with a pointer over there instead.
export default function MechanicPage() {
  const categoryFilter = useCallback(() => true, []);
  const buyDisabledReason = useCallback(
    (item: CatalogItem) =>
      item.category === ORE_CATEGORY ? "Visit Surveyor" : undefined,
    [],
  );

  return (
    <CatalogScreen
      section="mechanic"
      headerLinks={[
        { href: "/games/mining/build", label: "Build" },
        { href: "/games/mining/surveyor", label: "Surveyor" },
        { href: "/games/mining", label: "Back to run" },
      ]}
      categoryFilter={categoryFilter}
      buyDisabledReason={buyDisabledReason}
    />
  );
}
