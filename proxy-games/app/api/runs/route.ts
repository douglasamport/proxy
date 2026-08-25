import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/db/client';
import { currentPlayer } from '@/lib/auth';

// POST — save a completed run and settle its net against the player's
// balance. Requires a session; this is the "enter your email to save this
// run" moment, not a login wall in front of playing.
//
// Body: { game, seed, config, status, units, grade, net, moveLog }
//
// IMPORTANT: this trusts the client's score for now. That's fine for a solo
// leaderboard experiment; the moment a leaderboard has stakes worth gaming,
// replay `moveLog` server-side against the engine and recompute the score
// instead of trusting what was posted. The engine is already pure functions
// for exactly this reason — see minigame-v1-the-run.md.
export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const body = await req.json();
  const { game, seed, config, status, units, grade, net, moveLog } = body;

  if (!game || typeof seed !== 'number' || !status || typeof net !== 'number') {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  // The run's id is generated here (not by the DB default) so the ledger row
  // can reference it in the same atomic batch — the balance itself is one
  // shared pool across every game, `game` here just records where this
  // particular delta came from.
  const runId = randomUUID();
  const [[row]] = await sql.transaction([
    sql`
      insert into runs (id, player_id, game, seed, config, status, units, grade, net, move_log)
      values (
        ${runId}, ${player.id}, ${game}, ${seed}, ${JSON.stringify(config)},
        ${status}, ${units ?? 0}, ${grade ?? null}, ${net},
        ${JSON.stringify(moveLog ?? [])}
      )
      returning id, played_at
    `,
    sql`
      insert into balance_transactions (player_id, game, reason, delta, run_id)
      values (${player.id}, ${game}, 'run_net', ${net}, ${runId})
    `,
    sql`update players set balance = balance + ${net} where id = ${player.id}`,
  ]);

  return NextResponse.json({ ok: true, runId: row.id });
}

// GET /api/runs?game=mining — a player's own history, most recent first.
export async function GET(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const game = req.nextUrl.searchParams.get('game');
  const rows = game
    ? await sql`select * from runs where player_id = ${player.id} and game = ${game} order by played_at desc limit 50`
    : await sql`select * from runs where player_id = ${player.id} order by played_at desc limit 50`;

  return NextResponse.json({ runs: rows });
}
