import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import {
  computeChassis,
  getEquipmentSlotTotal,
  getSlotTotal,
  loadCatalog,
  loadEquipmentAvailable,
  loadInventory,
} from '@/lib/mining-inventory';

// GET /api/inventory?game=mining ->
//   { catalog, inventory, balance, chassis, slotTotal, equipmentSlotTotal, equipmentAvailable }
// Shared read used by the Store (browse + buy), the Build screen (equip
// from what's owned), and the fitting/run pages (read-only chassis
// preview, "use X" buttons) — one source of truth for all of them, rather
// than separate endpoints that could drift out of sync. `chassis`,
// `slotTotal`, and `equipmentSlotTotal` are computed here so nothing
// downstream re-derives them from raw catalog/inventory rows and risks
// getting that math wrong. `equipmentAvailable` is the list of equipment
// item_keys currently equipped — checked live, not snapshotted, since
// those can run out mid-run (see /api/runs/[id]/siphon and /scan-line).
export async function GET(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const game = req.nextUrl.searchParams.get('game');
  if (!game) return NextResponse.json({ error: 'missing game' }, { status: 400 });

  const [catalog, inventory, chassis, slotTotal, equipmentSlotTotal, equipmentAvailable] = await Promise.all([
    loadCatalog(game),
    loadInventory(player.id),
    computeChassis(player.id),
    getSlotTotal(player.id),
    getEquipmentSlotTotal(player.id),
    loadEquipmentAvailable(player.id),
  ]);

  return NextResponse.json({
    catalog, inventory, balance: player.balance, chassis, slotTotal, equipmentSlotTotal, equipmentAvailable,
  });
}
