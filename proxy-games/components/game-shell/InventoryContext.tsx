"use client";

// Generic /api/inventory-backed context — extracted from what was
// app/games/mining/layout.tsx's InventoryProvider so a second game (refine)
// doesn't need its own copy of this fetch/state plumbing. GET
// /api/inventory?game=... already takes `game` as a plain argument (see
// app/api/inventory/route.ts), so this only needed a `game` prop, nothing
// structural changed.
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
import { CFG, chassisFromEffects, Chassis } from "@/lib/mining-engine";
import type { CatalogItem, InventoryRow } from "@/lib/mining-inventory";

const EQUIPMENT_CATEGORY = "equipment";

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

// `chassis`/`slotTotal`/`equipmentSlotTotal` are mining-specific concepts
// (chassis gear slots) that just come back 0/default for a game whose
// /api/inventory response doesn't populate them — refine's store screens
// don't read those fields, they only use catalog/inventory/balance/load.
export function InventoryProvider({
  game,
  apiPath,
  equipmentCategories = [EQUIPMENT_CATEGORY],
  children,
}: {
  game: string;
  // Defaults to the shared /api/inventory?game= route (mining, refine).
  // Land-clearing has its own route instead — a different chassis shape
  // (see lib/land-clearing-engine.ts's Chassis) and its own starter-kit
  // logic live behind it — so it passes its own path here. CatalogScreen
  // never reads `chassis` directly, so the type mismatch is harmless: this
  // context's `chassis` field is typed for mining/refine, but a consumer
  // that only needs catalog/inventory/balance/load works with either shape.
  apiPath?: string;
  // Which catalog categories count as the "second pool" (equippedEquipmentTotal
  // / equipmentSlotTotal) rather than the general chassis pool
  // (equippedChassisTotal / slotTotal). Mining's is a single category
  // ('equipment' — ore siphon, line scanner); land-clearing's weapon mounts
  // are the same shape but three categories (weapon/ranged/aoe — see
  // db/022_weapon_mounts.sql), so this needed to become a list.
  equipmentCategories?: string[];
  children: React.ReactNode;
}) {
  const [equipmentSlotTotal, setEquipmentSlotTotal] = useState(0);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [chassis, setChassis] = useState<Chassis>(() => chassisFromEffects({}));
  const [slotTotal, setSlotTotal] = useState(CFG.SLOT_TOTAL);
  const [authRequired, setAuthRequired] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(apiPath ?? `/api/inventory?game=${game}`);
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
  }, [game, apiPath]);

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

  let equippedChassisTotal = 0;
  let equippedEquipmentTotal = 0;
  for (const row of inventory) {
    if (row.equipped_quantity <= 0) continue;
    if (equipmentCategories.includes(catByKey.get(row.item_key)?.category ?? ""))
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
