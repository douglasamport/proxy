"use client";

// One shell for every site (see app/site/[siteId]/layout.tsx) — replaces
// the old per-game MiningLayout/RefineLayout, which were identical apart
// from which `game` slug and nav links they hardcoded. Site data (name,
// activity_type) comes from the server layout that resolved it from the
// `sites` table; this component only knows how to turn that into a game
// slug, a nav-link list, and the header/auth-gate chrome.
import { GameHeader } from "@/components/game-shell/GameHeader";
import {
  InventoryProvider,
  useInventory,
} from "@/components/game-shell/InventoryContext";
import { ACCENTS, ATOMS } from "@/lib/mining-theme";
import { useSelectedLayoutSegments } from "next/navigation";

type NavLink = { href: string; label: string };

const SECTIONS: Record<string, { path: string; label: string }[]> = {
  extraction: [
    { path: "", label: "mining run" },
    { path: "build", label: "build" },
    { path: "store", label: "store" },
    { path: "surveyor", label: "surveyor" },
  ],
  refining: [
    { path: "", label: "refinery" },
    { path: "rig", label: "rig" },
    { path: "store", label: "store" },
  ],
};

const AUTH_GATE_COPY: Record<string, string> = {
  extraction:
    "Live run state now lives server-side against your account, so playing (not just saving) needs you signed in.",
  refining:
    "Live batch state lives server-side against your account, so refining (not just browsing the store) needs you signed in.",
};

export function SiteShell({
  siteId,
  siteName,
  activityType,
  children,
}: {
  siteId: string;
  siteName: string;
  activityType: string;
  children: React.ReactNode;
}) {
  return (
    <InventoryProvider activityType={activityType}>
      <SiteChrome siteId={siteId} siteName={siteName} activityType={activityType}>
        {children}
      </SiteChrome>
    </InventoryProvider>
  );
}

function SiteChrome({
  siteId,
  siteName,
  activityType,
  children,
}: {
  siteId: string;
  siteName: string;
  activityType: string;
  children: React.ReactNode;
}) {
  const pathname = useSelectedLayoutSegments();
  const sections = SECTIONS[activityType] ?? [];
  const currentPath = pathname.length ? pathname[0] : "";
  const section =
    sections.find((s) => s.path === currentPath)?.label ?? currentPath;

  const {
    authRequired,
    equippedChassisTotal,
    equippedEquipmentTotal,
    balance,
    slotTotal,
    equipmentSlotTotal,
  } = useInventory();

  const links: NavLink[] = sections
    .filter((s) => s.path !== currentPath)
    .map((s) => ({
      href: s.path ? `/site/${siteId}/${s.path}` : `/site/${siteId}`,
      label: s.label,
    }));

  // Extraction only shows stats on its build/store/surveyor sub-screens
  // (the run screen has its own in-page readouts); refining shows the
  // balance everywhere, on the batch screen too — matches each site's old
  // per-game layout exactly.
  const balanceStat = { label: "balance", value: balance ?? "—" };
  const extractionStats: Record<string, { label: string; value: string }[]> = {
    build: [
      { label: "slots", value: `${equippedChassisTotal} / ${slotTotal}` },
      {
        label: "equipment",
        value: `${equippedEquipmentTotal} / ${equipmentSlotTotal}`,
      },
      balanceStat,
    ],
    store: [balanceStat],
    surveyor: [balanceStat],
  };
  const stats =
    activityType === "refining" ? [balanceStat] : (extractionStats[currentPath] ?? []);

  if (authRequired) {
    return (
      <div className={`min-h-screen ${ATOMS.bgVoid}`}>
        <GameHeader title={siteName} section={section} stats={stats} links={links} />
        <main className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className={`text-sm ${ATOMS.textDim}`}>
            {AUTH_GATE_COPY[activityType] ??
              "This site's state lives server-side against your account — you need to be signed in."}
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
      <GameHeader title={siteName} section={section} stats={stats} links={links} />
      {children}
    </>
  );
}
