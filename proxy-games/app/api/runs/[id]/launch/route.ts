import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/db/client';
import { currentPlayer } from '@/lib/auth';
import { loadFittingRun, toPublicView } from '@/lib/mining-run-store';
import { computeChassis, loadoutSnapshot } from '@/lib/mining-inventory';
import { CFG, applySurvey, createRun } from '@/lib/mining-engine';

// POST { claim } -> the initial PublicRunView for the run.
//
// No `alloc` in the request anymore — chassis stats are computed
// server-side from whatever's actually equipped in player_inventory (see
// lib/mining-inventory.ts). A client claiming a build it doesn't own isn't
// a thing that can happen now; the only way to change your chassis is
// POST /api/inventory/equip, which validates ownership itself. Survey
// still isn't read from the body either, same reasoning — see the equip
// route's sibling, app/api/runs/[id]/survey/route.ts.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const claim = body.claim;
  if (!CFG.CLAIM_OPTIONS.includes(claim)) {
    return NextResponse.json({ error: 'invalid claim size' }, { status: 400 });
  }

  const row = await loadFittingRun(id, player.id);
  if (!row) {
    return NextResponse.json({ error: 'run not found' }, { status: 404 });
  }

  const [chassis, loadout] = await Promise.all([
    computeChassis(player.id),
    loadoutSnapshot(player.id),
  ]);
  const state = applySurvey(createRun(row.seed, chassis, claim), row.survey);

  const [saved] = await sql`
    update in_progress_runs
    set phase = 'active', loadout = ${JSON.stringify(loadout)}::jsonb, claim = ${claim},
        state = ${JSON.stringify({ ...state, seen: Array.from(state.seen) })}::jsonb, updated_at = now()
    where id = ${id} and player_id = ${player.id} and phase = 'fitting'
    returning id
  `;
  if (!saved) {
    return NextResponse.json({ error: 'run already launched' }, { status: 409 });
  }

  return NextResponse.json(toPublicView(id, state));
}
