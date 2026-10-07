import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/db/client';
import { currentPlayer } from '@/lib/auth';
import { getSite } from '@/lib/sites';

// POST used to live here, trusting a client-submitted score wholesale.
// That's gone — a run's result is now only ever written server-side, inside
// POST /api/runs/[id]/end, from state the server computed itself. Nothing
// should write to `runs` any other way; see lib/mining-run-store.ts and
// app/api/runs/[id]/*.

// GET /api/runs?siteId=… — a player's own history (optionally one site),
// most recent first.
export async function GET(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (siteId && !(await getSite(siteId))) {
    return NextResponse.json({ error: 'unknown site' }, { status: 404 });
  }

  const rows = siteId
    ? await sql`select * from runs where player_id = ${player.id} and site_id = ${siteId} order by played_at desc limit 50`
    : await sql`select * from runs where player_id = ${player.id} order by played_at desc limit 50`;

  return NextResponse.json({ runs: rows });
}
