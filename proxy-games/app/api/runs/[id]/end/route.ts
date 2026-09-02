import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { loadActiveRun, saveActiveState, toPublicView } from '@/lib/mining-run-store';
import { CFG, applyEnd, runAI, score } from '@/lib/mining-engine';

// POST { force? } -> { view, you, ai, seed } — ends the run and returns a
// score preview for both sides, but does NOT settle it. Settlement (credit
// vs stockpile — see Stage 2 of build-spec-ore-progression.md) happens via
// a separate POST /api/runs/[id]/settle once the player has seen these
// numbers in ResultsModal and picked. The row stays in in_progress_runs
// (terminal state.status, still phase 'active') until then — see settleRun
// in lib/mining-run-store.ts, and settleAbandonedRuns() there for the
// safety net if the player never comes back to choose. The seed is included
// in the response for the first time here, since the run is now over and
// safe to disclose (see db/003_in_progress_runs.sql).
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

  // Re-sync: map size is per-run now (Stage 6), and CFG.W/H is a shared
  // global — the await above is a point another request's code could have
  // run in between and left it pointing at a different run's dims. See the
  // comment on deserializeState() in lib/mining-run-store.ts.
  CFG.W = r.s.w;
  CFG.H = r.s.h;
  const you = score(r.s);
  const ai = score(runAI(r.s.seed, r.s.chassis, r.s.energyStart, r.s.unlockedOreTypes));

  return NextResponse.json({
    view: toPublicView(id, r.s),
    you, ai,
    seed: r.s.seed,
    energyStart: r.s.energyStart,
    status: r.s.status,
  });
}
