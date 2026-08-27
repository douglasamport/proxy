import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { assignNewField } from '@/lib/mining-run-store';

// POST { game, seed? } -> { runId, balance }
//
// Always starts a BRAND NEW field, discarding any unlaunched fitting run —
// this is the explicit "I want a different field" action (dev reseed,
// Refit, Play again), not what runs on a plain page load/navigation. See
// POST /api/runs/current for the resume-if-possible path that mount uses.
//
// The seed is generated here, server-side, and never returned — sending it
// to the client would be equivalent to sending the whole field, since field
// generation is a pure deterministic function of the seed. `seed` in the
// request body is only ever honored outside production (see below), for
// the same reason the dev-only seed input exists in the UI: hiding a
// control client-side isn't a security boundary, this is the actual gate.
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { game, seed: requestedSeed } = body;

  if (typeof game !== 'string' || !game) {
    return NextResponse.json({ error: 'missing game' }, { status: 400 });
  }

  const seed = process.env.NODE_ENV !== 'production' && typeof requestedSeed === 'number'
    ? requestedSeed
    : Math.floor(Math.random() * 9000) + 1000;

  const { runId, balance } = await assignNewField(player.id, game, seed);
  return NextResponse.json({ runId, balance });
}
