import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { applyActiveAction } from '@/lib/mining-run-store';
import { applyLineScan } from '@/lib/mining-engine';
import type { DirKey } from '@/lib/mining-engine';
import { consumeEquippedItem, hasEquippedConsumable } from '@/lib/mining-inventory';

const ITEM_KEY = 'line_scanner';
const VALID_DIRS: DirKey[] = ['N', 'S', 'E', 'W'];

// POST { direction } -> { view, err? } | error
// Same live-check-then-consume-on-success contract as /siphon — see that
// route's comment.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const direction = body.direction as DirKey;
  if (!VALID_DIRS.includes(direction)) {
    return NextResponse.json({ error: 'invalid direction' }, { status: 400 });
  }

  const owned = await hasEquippedConsumable(player.id, ITEM_KEY);
  if (!owned) return NextResponse.json({ error: 'no line scanner equipped' }, { status: 400 });

  const { id } = await params;
  const result = await applyActiveAction(id, player.id, s => applyLineScan(s, direction));
  if (result.kind === 'not_found') return NextResponse.json({ error: 'run not found' }, { status: 404 });
  if (result.kind === 'conflict') return NextResponse.json({ error: 'conflicting request, retry' }, { status: 409 });

  if (!result.err) await consumeEquippedItem(player.id, ITEM_KEY);

  return NextResponse.json({ view: result.view, err: result.err });
}
