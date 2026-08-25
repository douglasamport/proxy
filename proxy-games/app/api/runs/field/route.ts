import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/db/client';
import { currentPlayer } from '@/lib/auth';

// POST { game, seed? } -> { runId }
//
// Assigns a field for the player to fit out and (eventually) play. The seed
// is generated here, server-side, and never returned — sending it to the
// client would be equivalent to sending the whole field, since field
// generation is a pure deterministic function of the seed. `seed` in the
// request body is only ever honored outside production (see below), for
// the same reason the dev-only seed input exists in the UI: hiding a
// control client-side isn't a security boundary, this is the actual gate.
export async function POST(req: NextRequest) {
  const player = await currentPlayer();
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

  // A player can only be mid-fitting on one field per game at a time —
  // clear out any abandoned ones (nothing was ever spent on them).
  await sql`delete from in_progress_runs where player_id = ${player.id} and game = ${game} and phase = 'fitting'`;

  const [row] = await sql`
    insert into in_progress_runs (player_id, game, seed, phase)
    values (${player.id}, ${game}, ${seed}, 'fitting')
    returning id
  `;

  return NextResponse.json({ runId: row.id });
}
