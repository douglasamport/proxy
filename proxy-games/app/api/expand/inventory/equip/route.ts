import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { setEquipped } from '@/lib/land-clearing-inventory';
import { getActiveProxy } from '@/lib/proxy-store';

const GAME = 'land_clearing';

// POST { item_key, quantity } -> { ok: true } | error — see
// app/api/inventory/equip/route.ts, mining's equivalent, for the shape
// this mirrors.
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const itemKey = body.item_key;
  const quantity = body.quantity;

  if (typeof itemKey !== 'string' || !itemKey || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const proxy = await getActiveProxy(player.id, GAME);
  const result = await setEquipped(player.id, proxy.id, itemKey, quantity);
  if (result === 'not_owned') return NextResponse.json({ error: 'not enough owned' }, { status: 400 });
  if (result === 'over_cap') return NextResponse.json({ error: 'exceeds slot cap' }, { status: 400 });

  return NextResponse.json({ ok: true });
}
