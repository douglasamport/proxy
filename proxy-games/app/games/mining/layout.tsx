"use client";

import { GameHeader } from "@/components/game-shell/GameHeader";
import {
  InventoryProvider as SharedInventoryProvider,
  useInventory,
} from "@/components/game-shell/InventoryContext";
import { ACCENTS, ATOMS } from "@/lib/mining-theme";

import { useSelectedLayoutSegments } from "next/navigation";

type NavLink = {
  href: string;
  label: string;
};

// Thin mining-scoped wrapper around the shared, game-parameterized provider
// (see components/game-shell/InventoryContext.tsx) — kept so every mining
// file that already does `import { useInventory } from "../layout"` (or
// "@/app/games/mining/layout") keeps working unchanged.
export function InventoryProvider({ children }: { children: React.ReactNode }) {
  return (
    <SharedInventoryProvider game="mining">{children}</SharedInventoryProvider>
  );
}
export { useInventory };

export default function MiningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = useSelectedLayoutSegments();
  const section = !pathname.length ? "mining run" : pathname[0];

  //   const [devSeedInput, setDevSeedInput] = useState("");

  return (
    <div className="mining-game-wrapper">
      <InventoryProvider>
        <MiningShell section={section}>{children}</MiningShell>
      </InventoryProvider>
    </div>
  );
}

// function handleReseed() {
//   const parsed = parseInt(devSeedInput, 10);
//   assignField(Number.isFinite(parsed) ? parsed : undefined);
// }

// Wraps every mining page: header + nav + stats, and the actual auth gate —
// unauthenticated players see only the sign-in prompt, never the page
// underneath it (children only render in the non-gated branch below).
function MiningShell({
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
    { href: "/games/mining", label: "mining run" },
    { href: "/games/mining/build", label: "build" },
    { href: "/games/mining/store", label: "store" },
    { href: "/games/mining/surveyor", label: "surveyor" },
  ].filter(({ label }) => !(label === section));

  const statsDisplay: Record<string, { label: string; value: string }[]> = {
    build: [
      { label: "slots", value: `${equippedChassisTotal} / ${slotTotal}` },
      {
        label: "equipment",
        value: `${equippedEquipmentTotal} / ${equipmentSlotTotal}`,
      },
      { label: "balance", value: balance ?? "—" },
    ],
    store: [{ label: "balance", value: balance ?? "—" }],
    surveyor: [{ label: "balance", value: balance ?? "—" }],
  };

  const stats = statsDisplay[section] ?? [];

  if (authRequired) {
    return (
      <div className={`min-h-screen ${ATOMS.bgVoid}`}>
        <GameHeader section={section} stats={stats} links={links} />
        <main className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className={`text-sm ${ATOMS.textDim}`}>
            Live run state now lives server-side against your account, so
            playing (not just saving) needs you signed in.
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
      <GameHeader section={section} stats={stats} links={links}>
        {/* {SHOW_SEED_CONTROLS && (
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[11px] ${ATOMS.textDim}`}>seed</span>
            <input
              placeholder="random"
              value={devSeedInput}
              onChange={(e) => setDevSeedInput(e.target.value)}
              className={`w-24 rounded border ${ATOMS.borderLine} bg-transparent px-2 py-1 font-mono text-[11px] ${ATOMS.textPrimary}`}
            />
            <button
              onClick={handleReseed}
              className={`rounded border ${ATOMS.borderLine} px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.12em] ${ATOMS.textDim} transition ${SURFACE.navLinkHover}`}
            >
              New field
            </button>
          </div>
        )}
        <button
          onClick={handleRefit}
          disabled={phase === "fit"}
          className={`rounded border ${ATOMS.borderLine} px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.12em] ${ATOMS.textDim} transition ${SURFACE.navLinkHover} disabled:cursor-not-allowed disabled:opacity-30`}
        >
          Refit
        </button> */}
      </GameHeader>
      {children}
    </>
  );
}
