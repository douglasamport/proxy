import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { computeChassis, getSlotTotal, loadCatalog, loadInventory } from '@/lib/mining-inventory';

// GET /api/inventory?game=mining -> { catalog, inventory, balance, chassis, slotTotal }
// Shared read used by the Store (browse + buy), the Build screen (equip
// from what's owned), and the fitting page (read-only chassis preview) —
// one source of truth for all three, rather than separate endpoints that
// could drift out of sync. `chassis` and `slotTotal` are computed here
// (baseline effects, owned chassis expansions) so nothing downstream
// re-derives them from raw catalog/inventory rows and risks getting that
// math wrong.
export async function GET(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const game = req.nextUrl.searchParams.get('game');
  if (!game) return NextResponse.json({ error: 'missing game' }, { status: 400 });

  const [catalog, inventory, chassis, slotTotal] = await Promise.all([
    loadCatalog(game),
    loadInventory(player.id),
    computeChassis(player.id),
    getSlotTotal(player.id),
  ]);

  return NextResponse.json({ catalog, inventory, balance: player.balance, chassis, slotTotal });
}
