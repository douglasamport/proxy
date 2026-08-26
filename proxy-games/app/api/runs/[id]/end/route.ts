import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { loadActiveRun, saveActiveState, settleRun, toPublicView } from '@/lib/mining-run-store';
import { applyEnd } from '@/lib/mining-engine';

// POST { force? } -> { view, you, ai, seed } and settles the run.
//
// Runs applyEnd() server-side (same as every other action), then — only if
// the run actually ended — hands off to settleRun() (shared with
// settleAbandonedRuns(), see lib/mining-run-store.ts) to score both sides,
// write the ledger, and delete the row. The seed is included in the
// response for the first time here, since the run is now over and safe to
// disclose (see db/003_in_progress_runs.sql).
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

  const { you, ai } = await settleRun(loaded.row, r.s);

  return NextResponse.json({
    view: toPublicView(id, r.s),
    you, ai,
    seed: r.s.seed,
    energyStart: r.s.energyStart,
    status: r.s.status,
  });
}
