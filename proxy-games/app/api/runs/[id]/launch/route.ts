import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/db/client';
import { currentPlayer } from '@/lib/auth';
import { loadFittingRun } from '@/lib/mining-run-store';
import { toPublicView } from '@/lib/mining-run-store';
import { CFG, applySurvey, chassisFrom, createRun } from '@/lib/mining-engine';
import type { Alloc, SurveyTier } from '@/lib/mining-engine';

const SYSTEMS: (keyof Alloc)[] = ['fuel', 'cargo', 'armour', 'drive', 'steer', 'sensor', 'analyser'];
const VALID_TIERS: SurveyTier[] = ['none', 'basic', 'full'];

// The client sends its chosen `alloc` — not a derived chassis. Computing
// chassis stats server-side from a validated allocation is what stops a
// modified client from just declaring "my fuel capacity is 999999".
function validateAlloc(alloc: unknown): Alloc | null {
  if (!alloc || typeof alloc !== 'object') return null;
  const a = alloc as Record<string, unknown>;
  const out: Partial<Alloc> = {};
  let total = 0;
  for (const k of SYSTEMS) {
    const v = a[k];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return null;
    out[k] = v;
    total += v;
  }
  if (total > CFG.VOLUME_TOTAL) return null;
  return out as Alloc;
}

// POST { alloc, claim, survey } -> the initial PublicRunView for the run.
// Validates alloc and claim server-side, computes chassis, creates the live
// state, and flips the row from 'fitting' to 'active'.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer();
  if (!player) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const alloc = validateAlloc(body.alloc);
  if (!alloc) {
    return NextResponse.json({ error: 'invalid build allocation' }, { status: 400 });
  }
  const claim = body.claim;
  if (!CFG.CLAIM_OPTIONS.includes(claim)) {
    return NextResponse.json({ error: 'invalid claim size' }, { status: 400 });
  }
  const survey: SurveyTier = VALID_TIERS.includes(body.survey) ? body.survey : 'none';

  const row = await loadFittingRun(id, player.id);
  if (!row) {
    return NextResponse.json({ error: 'run not found' }, { status: 404 });
  }

  const chassis = chassisFrom(alloc);
  const state = applySurvey(createRun(row.seed, chassis, claim), survey);

  const [saved] = await sql`
    update in_progress_runs
    set phase = 'active', alloc = ${JSON.stringify(alloc)}::jsonb, claim = ${claim}, survey = ${survey},
        state = ${JSON.stringify({ ...state, seen: Array.from(state.seen) })}::jsonb, updated_at = now()
    where id = ${id} and player_id = ${player.id} and phase = 'fitting'
    returning id
  `;
  if (!saved) {
    return NextResponse.json({ error: 'run already launched' }, { status: 409 });
  }

  return NextResponse.json(toPublicView(id, state));
}
