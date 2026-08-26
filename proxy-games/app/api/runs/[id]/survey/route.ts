import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { loadFittingRun, purchaseSurvey } from '@/lib/mining-run-store';
import { CFG, surveyReport } from '@/lib/mining-engine';
import type { SurveyTier } from '@/lib/mining-engine';

// Survey is a real purchase now, not a free preview — 'none' isn't
// something you buy, it's just the default before you've bought anything.
const PURCHASABLE_TIERS: SurveyTier[] = ['basic', 'full'];

// POST { tier } -> { report, balance }
//
// Charges immediately, no refund for switching tiers afterward — the
// player already has the data the moment the purchase succeeds, so there's
// nothing to "give back". The tier actually paid for is recorded on the
// fitting row itself; launch reads that, not anything the client sends, so
// a modified client can't pay for Basic and then apply Detailed for free.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const tier = body.tier as SurveyTier;

  if (!PURCHASABLE_TIERS.includes(tier)) {
    return NextResponse.json({ error: 'invalid tier' }, { status: 400 });
  }

  const row = await loadFittingRun(id, player.id);
  if (!row) {
    return NextResponse.json({ error: 'run not found' }, { status: 404 });
  }

  const cost = CFG.SURVEY[tier].cost;
  const result = await purchaseSurvey(id, player.id, row.game, tier, cost);
  if (result.kind === 'insufficient_funds') {
    return NextResponse.json({ error: 'insufficient funds' }, { status: 402 });
  }
  if (result.kind === 'not_found') {
    return NextResponse.json({ error: 'run not found' }, { status: 404 });
  }

  const report = surveyReport(row.seed, tier);
  return NextResponse.json({ report, balance: result.balance });
}
