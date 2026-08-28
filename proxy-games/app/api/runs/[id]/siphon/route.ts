import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { applyActiveAction } from '@/lib/mining-run-store';
import { applySiphon } from '@/lib/mining-engine';
import { consumeEquippedItem, hasEquippedConsumable } from '@/lib/mining-inventory';

const ITEM_KEY = 'ore_siphon';

// POST -> { view, err? } | error
// The consumable is checked live against player_inventory (not the run's
// own state — nothing about equipment is snapshotted at launch, since the
// whole point is it can run out mid-run), and only actually spent once the
// state mutation it enabled succeeds without an err — a rejected/no-op use
// shouldn't cost the item.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const owned = await hasEquippedConsumable(player.id, ITEM_KEY);
  if (!owned) return NextResponse.json({ error: 'no ore siphon equipped' }, { status: 400 });

  const { id } = await params;
  const result = await applyActiveAction(id, player.id, applySiphon);
  if (result.kind === 'not_found') return NextResponse.json({ error: 'run not found' }, { status: 404 });
  if (result.kind === 'conflict') return NextResponse.json({ error: 'conflicting request, retry' }, { status: 409 });

  if (!result.err) await consumeEquippedItem(player.id, ITEM_KEY);

  return NextResponse.json({ view: result.view, err: result.err });
}
