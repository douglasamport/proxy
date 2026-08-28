import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { purchaseEquipmentSlotUnlock } from '@/lib/mining-inventory';

// POST { game } -> { balance } | error
// One-time-only purchase, unlike /api/store/expand (repeatable, doubling
// price) — see purchaseEquipmentSlotUnlock().
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { game } = body;
  if (typeof game !== 'string' || !game) {
    return NextResponse.json({ error: 'missing game' }, { status: 400 });
  }

  const result = await purchaseEquipmentSlotUnlock(player.id, game);
  if (result.kind === 'not_found') return NextResponse.json({ error: 'equipment bay not available' }, { status: 404 });
  if (result.kind === 'insufficient_funds') return NextResponse.json({ error: 'insufficient funds' }, { status: 402 });
  if (result.kind === 'already_owned') return NextResponse.json({ error: 'already own an equipment slot' }, { status: 409 });

  return NextResponse.json({ balance: result.balance });
}
