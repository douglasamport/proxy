import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { getActiveProxy, purchaseChassisExpansion } from '@/lib/proxy-store';

// POST { game } -> { balance, slotTotal } | error
// Separate from POST /api/store/buy because the price isn't flat — each
// expansion a player already owns doubles the cost of the next one, so it
// can't reuse the generic quantity * cost purchase path.
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { game } = body;
  if (typeof game !== 'string' || !game) {
    return NextResponse.json({ error: 'missing game' }, { status: 400 });
  }

  const proxy = await getActiveProxy(player.id, game);
  const result = await purchaseChassisExpansion(player.id, proxy.id, game);
  if (result.kind === 'not_found') return NextResponse.json({ error: 'expansion not available' }, { status: 404 });
  if (result.kind === 'insufficient_funds') return NextResponse.json({ error: 'insufficient funds' }, { status: 402 });

  return NextResponse.json({ balance: result.balance, slotTotal: result.slotTotal });
}
