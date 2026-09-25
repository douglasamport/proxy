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
import type { ChassisSlot } from "@/lib/proxies";

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
  slots: ChassisSlot[];
  setSlots: Dispatch<SetStateAction<ChassisSlot[]>>;
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
  children,
}: {
  game: string;
  children: React.ReactNode;
}) {
  const [equipmentSlotTotal, setEquipmentSlotTotal] = useState(0);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [chassis, setChassis] = useState<Chassis>(() => chassisFromEffects({}));
  const [slotTotal, setSlotTotal] = useState(CFG.SLOT_TOTAL);
  const [slots, setSlots] = useState<ChassisSlot[]>([]);
  const [authRequired, setAuthRequired] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/inventory?game=${game}`);
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
    setSlots(data.slots ?? []);
  }, [game]);

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

  // Games on the chassis_slots model (mining) report real slots, not an
  // equipped_quantity column (see db/021_migrate_mining_proxy.sql — that
  // column is zeroed for mining items now). Count filled slots directly
  // when slots come back non-empty; fall back to the old inventory-based
  // count for a game that hasn't moved onto the slot model yet (refine).
  let equippedChassisTotal = 0;
  let equippedEquipmentTotal = 0;
  if (slots.length > 0) {
    for (const slot of slots) {
      if (!slot.installed_item_id) continue;
      if (slot.slot_type === "carriage") equippedEquipmentTotal++;
      else equippedChassisTotal++;
    }
  } else {
    for (const row of inventory) {
      if (row.equipped_quantity <= 0) continue;
      if (catByKey.get(row.item_key)?.category === EQUIPMENT_CATEGORY)
        equippedEquipmentTotal += row.equipped_quantity;
      else equippedChassisTotal += row.equipped_quantity;
    }
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
        slots,
        setSlots,
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
