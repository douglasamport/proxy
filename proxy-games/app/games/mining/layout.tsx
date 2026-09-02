"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  use,
  useMemo,
  Dispatch,
  SetStateAction,
} from "react";

import { GameHeader } from "@/app/games/mining/components/GameHeader";
import { ACCENTS, ATOMS } from "@/lib/mining-theme";
import {
  CFG,
  chassisFromEffects,
  Chassis,
  fuelMult,
} from "@/lib/mining-engine";
import type { CatalogItem, InventoryRow } from "@/lib/mining-inventory";
const EQUIPMENT_CATEGORY = "equipment";

import { usePathname, useSelectedLayoutSegments } from "next/navigation";
const SHOW_SEED_CONTROLS = process.env.NODE_ENV !== "production";

type NavLink = {
  href: string;
  label: string;
};

interface InventoryContextType {
  authRequired: boolean;
  setAuthRequired: Dispatch<SetStateAction<boolean>>;
  equipmentSlotTotal: number;
  setEquipmentSlotTotal: Dispatch<SetStateAction<number>>;
  catalog: CatalogItem[];
  setCatalog: Dispatch<SetStateAction<CatalogItem[]>>;
  inventory: InventoryRow[];
  setInventory: Dispatch<SetStateAction<InventoryRow[]>>;
  balance: string | null;
  setBalance: Dispatch<SetStateAction<string | null>>;
  chassis: Chassis;
  setChassis: Dispatch<SetStateAction<Chassis>>;
  slotTotal: number;
  setSlotTotal: Dispatch<SetStateAction<number>>;
  load: () => Promise<void>;
  equippedChassisTotal: number;
  equippedEquipmentTotal: number;
}
export const InventoryContext = createContext<InventoryContextType | null>(
  null,
);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [equipmentSlotTotal, setEquipmentSlotTotal] = useState(0);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [chassis, setChassis] = useState<Chassis>(() => chassisFromEffects({}));
  const [slotTotal, setSlotTotal] = useState(CFG.SLOT_TOTAL);
  const [authRequired, setAuthRequired] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/inventory?game=mining");
    if (!res.ok) {
      if (res.status === 401) setAuthRequired(true);
      return;
    }
    setAuthRequired(false);
    const data = await res.json();
    setCatalog(data.catalog);
    setInventory(data.inventory);
    setBalance(data.balance);
    setChassis(data.chassis);
    setSlotTotal(data.slotTotal);
    setEquipmentSlotTotal(data.equipmentSlotTotal);
  }, []);

  const didLoadRef = useRef(false);
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    load();
  }, [load]);

  const catByKey = useMemo(
    () => new Map(catalog.map((c) => [c.item_key, c])),
    [catalog],
  );

  // Equipment items (ore siphon, line scanner) draw against their own
  // separate slot pool, not the chassis one — see getEquipmentSlotTotal()
  // in lib/mining-inventory.ts.

  let equippedChassisTotal = 0;
  let equippedEquipmentTotal = 0;
  for (const row of inventory) {
    if (row.equipped_quantity <= 0) continue;
    if (catByKey.get(row.item_key)?.category === EQUIPMENT_CATEGORY)
      equippedEquipmentTotal += row.equipped_quantity;
    else equippedChassisTotal += row.equipped_quantity;
  }

  return (
    <InventoryContext
      value={{
        equipmentSlotTotal,
        setEquipmentSlotTotal,
        catalog,
        setCatalog,
        inventory,
        setInventory,
        balance,
        setBalance,
        chassis,
        setChassis,
        slotTotal,
        setSlotTotal,
        authRequired,
        setAuthRequired,
        load,
        equippedChassisTotal,
        equippedEquipmentTotal,
      }}
    >
      {children}
    </InventoryContext>
  );
}

export function useInventory() {
  const context = use(InventoryContext);

  if (!context) {
    throw new Error(
      "useInventory must be used within the InventoryProvider context",
    );
  }

  return context;
}

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
