import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/db/client';

// GET /api/leaderboard/mining/1000 — best net per player on this exact seed.
// This is the shareable artifact: "I beat you on seed 1000" is a real,
// checkable claim, and the URL is the whole invite.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ game: string; seed: string }> }
) {
  const { game, seed } = await params;
  const seedNum = Number(seed);
  if (!Number.isFinite(seedNum)) {
    return NextResponse.json({ error: 'invalid seed' }, { status: 400 });
  }

  // best run per player on this game+seed
  const rows = await sql`
    select distinct on (player_id)
      p.display_name, p.id as player_id, r.net, r.grade, r.units, r.status, r.played_at
    from runs r
    join players p on p.id = r.player_id
    where r.game = ${game} and r.seed = ${seedNum}
    order by player_id, net desc
  `;

  rows.sort((a: any, b: any) => b.net - a.net);

  return NextResponse.json({ game, seed: seedNum, leaderboard: rows });
}
