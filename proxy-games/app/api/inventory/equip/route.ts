import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { setEquipped } from '@/lib/mining-inventory';

// POST { item_key, quantity } -> { ok: true } | error
// Sets the equipped count for one item to an exact target (not a delta —
// simpler for a stepper UI to reason about). Validates ownership and the
// combined slot cap server-side; never trusts the client's own idea of
// what it can afford to equip.
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const itemKey = body.item_key;
  const quantity = body.quantity;

  if (typeof itemKey !== 'string' || !itemKey || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const result = await setEquipped(player.id, itemKey, quantity);
  if (result === 'not_owned') return NextResponse.json({ error: 'not enough owned' }, { status: 400 });
  if (result === 'over_cap') return NextResponse.json({ error: 'exceeds slot cap' }, { status: 400 });

  return NextResponse.json({ ok: true });
}
