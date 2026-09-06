"use client";

import { GameHeader } from "@/components/game-shell/GameHeader";
import {
  InventoryProvider,
  useInventory,
} from "@/components/game-shell/InventoryContext";
import { ACCENTS, ATOMS } from "@/lib/mining-theme";

import { useSelectedLayoutSegments } from "next/navigation";

type NavLink = {
  href: string;
  label: string;
};

export default function RefineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = useSelectedLayoutSegments();
  const section = !pathname.length ? "refinery" : pathname[0];

  return (
    <div className="refine-game-wrapper">
      <InventoryProvider game="refine">
        <RefineShell section={section}>{children}</RefineShell>
      </InventoryProvider>
    </div>
  );
}

// Same auth-gate + header/nav shell as mining's MiningShell (see
// app/games/mining/layout.tsx) — both now sit on the same shared
// InventoryProvider/GameHeader, just pointed at a different `game`.
function RefineShell({
  section,
  children,
}: {
  section: string;
  children: React.ReactNode;
}) {
  const { authRequired, balance } = useInventory();

  const links: NavLink[] = [
    { href: "/games/refine", label: "refinery" },
    { href: "/games/refine/rig", label: "rig" },
    { href: "/games/refine/store", label: "store" },
  ].filter(({ label }) => !(label === section));

  const stats = [{ label: "balance", value: balance ?? "—" }];

  if (authRequired) {
    return (
      <div className={`min-h-screen ${ATOMS.bgVoid}`}>
        <GameHeader section={section} stats={stats} links={links} />
        <main className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className={`text-sm ${ATOMS.textDim}`}>
            Live batch state lives server-side against your account, so
            refining (not just browsing the store) needs you signed in.
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
      <GameHeader section={section} stats={stats} links={links} />
      {children}
    </>
  );
}
