import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { loadActiveRun, settleRun } from '@/lib/mining-run-store';
import type { SettleChoice } from '@/lib/mining-run-store';

// POST { choice: "credits" | "ore" } -> { you, ai }. Settles a run that has
// already ended (see POST /api/runs/[id]/end) — credits its net to the
// balance, or stockpiles the banked ore into player_inventory instead (see
// settleRun in lib/mining-run-store.ts). Called once the player has seen
// ResultsModal's numbers and picked one.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const choice: SettleChoice = body.choice === 'ore' ? 'ore' : 'credits';

  const loaded = await loadActiveRun(id, player.id);
  if (!loaded) return NextResponse.json({ error: 'run not found' }, { status: 404 });
  if (loaded.state.status === 'active') {
    return NextResponse.json({ error: 'run has not ended yet' }, { status: 400 });
  }

  const { you, ai } = await settleRun(loaded.row, loaded.state, choice);
  return NextResponse.json({ you, ai });
}
