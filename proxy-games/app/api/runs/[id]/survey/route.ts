import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { loadFittingRun } from '@/lib/mining-run-store';
import { surveyReport } from '@/lib/mining-engine';
import type { SurveyTier } from '@/lib/mining-engine';

const VALID_TIERS: SurveyTier[] = ['none', 'basic', 'full'];

// POST { tier } -> the aggregate survey report for that tier, computed
// fresh from the field this run is assigned to. Pure preview — doesn't
// mutate the run. Only ever returns totals (pocket count, mass, depth);
// never cell positions, same as the pure surveyReport() function itself.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer();
  if (!player) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const tier = body.tier as SurveyTier;

  if (!VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: 'invalid tier' }, { status: 400 });
  }

  const row = await loadFittingRun(id, player.id);
  if (!row) {
    return NextResponse.json({ error: 'run not found' }, { status: 404 });
  }

  const report = surveyReport(row.seed, tier);
  return NextResponse.json({ report });
}
