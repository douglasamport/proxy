import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import {
  computeChassis,
  getEquipmentSlotTotal,
  getSlotTotal,
  loadCatalog,
  loadEquipmentAvailable,
  loadInventory,
  resolveMiningProxy,
} from '@/lib/mining-inventory';
import { loadSlots } from '@/lib/proxies';

// GET /api/inventory?game=mining ->
//   { catalog, inventory, balance, chassis, slotTotal, equipmentSlotTotal, equipmentAvailable, slots }
// Shared read used by the Store (browse + buy), the Build screen (equip
// from what's owned), and the fitting/run pages (read-only chassis
// preview, "use X" buttons) — one source of truth for all of them, rather
// than separate endpoints that could drift out of sync. `chassis`,
// `slotTotal`, and `equipmentSlotTotal` are computed here so nothing
// downstream re-derives them from raw catalog/inventory rows and risks
// getting that math wrong. `equipmentAvailable` is the list of equipment
// item_keys currently equipped — checked live, not snapshotted, since
// those can run out mid-run (see /api/runs/[id]/siphon and /scan-line).
// `slots` is the character's active mining proxy's real chassis_slots rows
// (id/slot_type/installed_item_id) — always [] for a game that hasn't
// moved onto the proxy/slot model yet (see lib/mining-inventory.ts).
//
// For mining specifically, the character+proxy is resolved once here and
// slotTotal/equipmentSlotTotal/equipmentAvailable are derived from the one
// resulting `slots` read, instead of each going through mining-inventory.ts
// wrappers that independently re-resolve the same character+proxy — this
// request was ~17 DB round trips before, now ~8 (computeChassis() still
// resolves once more internally; narrowing that needs its own signature
// change, left alone here as lower-risk).
export async function GET(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const game = req.nextUrl.searchParams.get('game');
  if (!game) return NextResponse.json({ error: 'missing game' }, { status: 400 });

  const [catalog, inventory] = await Promise.all([
    loadCatalog(game),
    loadInventory(player.id, game),
  ]);

  if (game === 'mining') {
    const [chassis, slots] = await Promise.all([
      computeChassis(player.id),
      resolveMiningProxy(player.id).then(({ proxyId }) => loadSlots(proxyId)),
    ]);
    const slotTotal = slots.filter((s) => s.slot_type === 'standard').length;
    const equipmentSlotTotal = slots.filter((s) => s.slot_type === 'carriage').length;
    const equipmentAvailable = slots
      .filter((s) => s.slot_type === 'carriage' && s.installed_item_id)
      .map((s) => s.installed_item_id as string);

    return NextResponse.json({
      catalog, inventory, balance: player.balance, chassis, slotTotal, equipmentSlotTotal, equipmentAvailable, slots,
    });
  }

  const [chassis, slotTotal, equipmentSlotTotal, equipmentAvailable] = await Promise.all([
    computeChassis(player.id),
    getSlotTotal(player.id),
    getEquipmentSlotTotal(player.id),
    loadEquipmentAvailable(player.id),
  ]);

  return NextResponse.json({
    catalog, inventory, balance: player.balance, chassis, slotTotal, equipmentSlotTotal, equipmentAvailable, slots: [],
  });
}
