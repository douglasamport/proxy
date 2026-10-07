import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/db/client';
import { currentPlayer } from '@/lib/auth';
import { resolveSiteId } from '@/lib/sites';

// POST used to live here, trusting a client-submitted score wholesale.
// That's gone — a run's result is now only ever written server-side, inside
// POST /api/runs/[id]/end, from state the server computed itself. Nothing
// should write to `runs` any other way; see lib/mining-run-store.ts and
// app/api/runs/[id]/*.

// GET /api/runs?game=mining — a player's own history, most recent first.
export async function GET(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const game = req.nextUrl.searchParams.get('game');
  // `game` here is whatever the caller passes, not necessarily one of the
  // two real sites (this GET has always accepted an arbitrary string) — a
  // value with no matching site (a typo, or a leftover like 'land_clearing')
  // falls back to filtering on the raw `game` column, same as before this
  // moved onto site_id.
  const siteId = game
    ? await resolveSiteId(game).catch(() => null)
    : null;
  const rows = siteId
    ? await sql`select * from runs where player_id = ${player.id} and site_id = ${siteId} order by played_at desc limit 50`
    : game
      ? await sql`select * from runs where player_id = ${player.id} and game = ${game} order by played_at desc limit 50`
      : await sql`select * from runs where player_id = ${player.id} order by played_at desc limit 50`;

  return NextResponse.json({ runs: rows });
}
