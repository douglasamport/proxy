import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { sellItem } from '@/lib/mining-inventory';

// POST { game, item_key, quantity } -> { balance } | error
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { game, item_key: itemKey, quantity } = body;

  if (typeof game !== 'string' || !game || typeof itemKey !== 'string' || !itemKey
    || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const result = await sellItem(player.id, game, itemKey, quantity);
  if (result.kind === 'not_found') return NextResponse.json({ error: 'item not found' }, { status: 404 });
  if (result.kind === 'not_sellable') return NextResponse.json({ error: 'item not sellable' }, { status: 400 });
  if (result.kind === 'insufficient_owned') return NextResponse.json({ error: 'not enough owned' }, { status: 409 });

  return NextResponse.json({ balance: result.balance });
}
