import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/db/client';
import { currentPlayer } from '@/lib/auth';
import { loadActiveRun, saveActiveState, toPublicView } from '@/lib/mining-run-store';
import { applyEnd, runAI, score } from '@/lib/mining-engine';

// POST { force? } -> { view, you, ai, seed } and settles the run.
//
// Runs applyEnd() server-side (same as every other action), then — only if
// the run actually ended — computes both scores, writes the run + a
// balance_transactions ledger row + the players.balance update atomically
// (replacing what POST /api/runs used to do; that route no longer accepts
// writes, see its comment), and deletes the in_progress_runs row. The seed
// is included in the response for the first time here, since the run is
// now over and safe to disclose (see db/003_in_progress_runs.sql).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const force = body.force === true;

  const loaded = await loadActiveRun(id, player.id);
  if (!loaded) return NextResponse.json({ error: 'run not found' }, { status: 404 });

  const expectedStep = loaded.state.step;
  const r = applyEnd(loaded.state, force);

  if (r.s.status === 'active') {
    // didn't actually end (not at base, force not set) — save nothing, just
    // report why, same as any other rejected action.
    return NextResponse.json({ view: toPublicView(id, r.s), err: r.err });
  }

  const saved = await saveActiveState(id, expectedStep, r.s);
  if (!saved) return NextResponse.json({ error: 'conflicting request, retry' }, { status: 409 });

  const you = score(r.s);
  const ai = score(runAI(r.s.seed, r.s.chassis, r.s.energyStart));

  const runId = randomUUID();
  await sql.transaction([
    sql`
      insert into runs (id, player_id, game, seed, config, status, units, grade, net, move_log)
      values (
        ${runId}, ${player.id}, ${loaded.row.game}, ${r.s.seed},
        ${JSON.stringify({ alloc: r.s.chassis.alloc, claim: r.s.energyStart, survey: r.s.survey })},
        ${r.s.status}, ${you.units}, ${you.grade}, ${you.net},
        ${JSON.stringify(r.s.log)}
      )
    `,
    sql`
      insert into balance_transactions (player_id, game, reason, delta, run_id)
      values (${player.id}, ${loaded.row.game}, 'run_net', ${you.net}, ${runId})
    `,
    sql`update players set balance = balance + ${you.net} where id = ${player.id}`,
  ]);

  await sql`delete from in_progress_runs where id = ${id}`;

  return NextResponse.json({ view: toPublicView(id, r.s), you, ai, seed: r.s.seed });
}
