import { NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { applyActiveAction } from '@/lib/land-clearing-run-store';
import { move } from '@/lib/land-clearing-engine';

// POST { dx, dy, distance? } (dx,dy each -1|0|1, not both 0; distance
// optional, caps how many of the chassis's movement tiles this action
// actually spends — a player who can cover 2 tiles isn't forced to) ->
// { view, err? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const dx = body.dx;
  const dy = body.dy;
  const distance = body.distance;
  if (![-1, 0, 1].includes(dx) || ![-1, 0, 1].includes(dy) || (dx === 0 && dy === 0)) {
    return NextResponse.json({ error: 'invalid direction' }, { status: 400 });
  }
  if (distance != null && (typeof distance !== 'number' || !Number.isInteger(distance) || distance < 1)) {
    return NextResponse.json({ error: 'invalid distance' }, { status: 400 });
  }

  const result = await applyActiveAction(id, player.id, (s) => move(s, dx, dy, distance ?? undefined));
  if (result.kind === 'not_found') return NextResponse.json({ error: 'run not found' }, { status: 404 });
  if (result.kind === 'conflict') return NextResponse.json({ error: 'conflicting request, retry' }, { status: 409 });
  return NextResponse.json({ view: result.view, events: result.events, err: result.err });
}
