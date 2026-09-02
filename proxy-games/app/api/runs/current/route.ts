import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/db/client';
import { currentPlayer } from '@/lib/auth';
import { assignNewField, loadActiveRun, toPublicView } from '@/lib/mining-run-store';
import { loadUnlockedOreTypes } from '@/lib/mining-inventory';
import { fieldDims, surveyReport } from '@/lib/mining-engine';
import type { SurveyTier } from '@/lib/mining-engine';

// POST { game } -> the player's current in-progress run for this game,
// resumed as-is if one exists (fitting or active) — a fresh field is only
// generated when there truly isn't one yet. This is what page load and
// navigation call; unlike POST /api/runs/field (the explicit "give me a
// different field" action — reseed, refit, play again), it never discards
// an unlaunched fit or an active run, so bouncing to the build/store
// screens and back doesn't lose a bought survey or reroll the field.
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { game } = body;
  if (typeof game !== 'string' || !game) {
    return NextResponse.json({ error: 'missing game' }, { status: 400 });
  }

  const [row] = await sql`
    select id, phase, seed, survey from in_progress_runs
    where player_id = ${player.id} and game = ${game}
    order by created_at desc limit 1
  `;

  if (!row) {
    const seed = Math.floor(Math.random() * 9000) + 1000;
    const [{ runId, balance }, unlockedOreTypes] = await Promise.all([
      assignNewField(player.id, game, seed),
      loadUnlockedOreTypes(player.id),
    ]);
    const dims = fieldDims(unlockedOreTypes);
    return NextResponse.json({ phase: 'fitting', runId, survey: 'none', report: null, balance, dims });
  }

  if (row.phase === 'fitting') {
    const [[{ balance }], unlockedOreTypes] = await Promise.all([
      sql`select balance from players where id = ${player.id}`,
      loadUnlockedOreTypes(player.id),
    ]);
    const tier = row.survey as SurveyTier;
    const report = tier === 'none' ? null : surveyReport(row.seed, tier, unlockedOreTypes);
    const dims = fieldDims(unlockedOreTypes);
    return NextResponse.json({ phase: 'fitting', runId: row.id, survey: tier, report, balance, dims });
  }

  const active = await loadActiveRun(row.id, player.id);
  if (!active) {
    // The row vanished between the two reads (rare) — fall back to a fresh field.
    const seed = Math.floor(Math.random() * 9000) + 1000;
    const [{ runId, balance }, unlockedOreTypes] = await Promise.all([
      assignNewField(player.id, game, seed),
      loadUnlockedOreTypes(player.id),
    ]);
    const dims = fieldDims(unlockedOreTypes);
    return NextResponse.json({ phase: 'fitting', runId, survey: 'none', report: null, balance, dims });
  }
  const [{ balance }] = await sql`select balance from players where id = ${player.id}`;
  return NextResponse.json({ phase: 'active', runId: row.id, view: toPublicView(row.id, active.state), balance });
}
