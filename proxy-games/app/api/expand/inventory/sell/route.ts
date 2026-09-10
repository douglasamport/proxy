import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { sellItem } from '@/lib/land-clearing-inventory';

// POST { item_key, quantity } -> { balance } | error
//
// A land-clearing-specific route, not the shared /api/store/sell — that
// one calls mining-inventory.ts's sellItem(), whose FLAT_SELL_PRICE_CATEGORIES
// only knows about 'ore'/'refined'. Land-clearing's 'lc_scrap' has cost=0
// (no buy side — see db/020_land_clearing_catalog.sql), so pricing it as a
// ratio of cost would sell it for 0 credits; it needs land-clearing's own
// sellItem, whose flat-price set includes 'scrap'.
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { item_key: itemKey, quantity } = body;

  if (typeof itemKey !== 'string' || !itemKey
    || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const result = await sellItem(player.id, itemKey, quantity);
  if (result.kind === 'not_found') return NextResponse.json({ error: 'item not found' }, { status: 404 });
  if (result.kind === 'not_sellable') return NextResponse.json({ error: 'item not sellable' }, { status: 400 });
  if (result.kind === 'insufficient_owned') return NextResponse.json({ error: 'not enough owned' }, { status: 409 });

  return NextResponse.json({ balance: result.balance });
}
