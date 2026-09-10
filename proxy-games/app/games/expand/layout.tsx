"use client";

import { GameHeader } from "@/components/game-shell/GameHeader";
import {
  InventoryProvider as SharedInventoryProvider,
  useInventory,
} from "@/components/game-shell/InventoryContext";
import { ACCENTS, ATOMS } from "@/lib/mining-theme";
import { useSelectedLayoutSegments } from "next/navigation";

type NavLink = { href: string; label: string };

// Same thin-wrapper pattern as app/games/mining/layout.tsx — a
// expand-scoped provider pointed at its own /api/expand
// endpoints, since its chassis math and starter kit are entirely separate
// from mining's (see lib/expand-inventory.ts).
export function InventoryProvider({ children }: { children: React.ReactNode }) {
  return (
    <SharedInventoryProvider
      game="land_clearing"
      apiPath="/api/expand/inventory"
      equipmentCategories={["weapon", "ranged", "aoe"]}
    >
      {children}
    </SharedInventoryProvider>
  );
}
export { useInventory };

export default function LandClearingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = useSelectedLayoutSegments();
  const section = !pathname.length ? "parcel" : pathname[0];

  return (
    <InventoryProvider>
      <LandClearingShell section={section}>{children}</LandClearingShell>
    </InventoryProvider>
  );
}

function LandClearingShell({
  section,
  children,
}: {
  section: string;
  children: React.ReactNode;
}) {
  const {
    authRequired,
    equippedChassisTotal,
    equippedEquipmentTotal,
    balance,
    slotTotal,
    equipmentSlotTotal,
  } = useInventory();

  const links: NavLink[] = [
    { href: "/games/expand", label: "parcel" },
    { href: "/games/expand/build", label: "build" },
    { href: "/games/expand/store", label: "store" },
  ].filter(({ label }) => label !== section);

  const statsDisplay: Record<string, { label: string; value: string }[]> = {
    build: [
      { label: "slots", value: `${equippedChassisTotal} / ${slotTotal}` },
      { label: "weapon mounts", value: `${equippedEquipmentTotal} / ${equipmentSlotTotal}` },
      { label: "balance", value: balance ?? "—" },
    ],
    store: [{ label: "balance", value: balance ?? "—" }],
  };
  const stats = statsDisplay[section] ?? [];

  if (authRequired) {
    return (
      <div className={`min-h-screen ${ATOMS.bgVoid}`}>
        <GameHeader
          section={section}
          title="Land Clearing"
          stats={stats}
          links={links}
        />
        <main className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className={`text-sm ${ATOMS.textDim}`}>
            Live run state lives server-side against your account — sign in to
            enter the field.
          </p>
          <a
            href="/login"
            className={`mt-4 inline-block rounded px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider ${ATOMS.textVoid} ${ACCENTS.equipment.btn}`}
          >
            Sign in
          </a>
        </main>
      </div>
    );
  }

  return (
    <>
      <GameHeader
        section={section}
        title="Land Clearing"
        stats={stats}
        links={links}
      />
      {children}
    </>
  );
}
