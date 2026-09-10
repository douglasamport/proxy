import { NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { loadActiveRun, settleRun } from '@/lib/land-clearing-run-store';

// POST {} -> ScoreResult. Settles a run that has already ended (status is
// no longer 'active') — grants scrap/parts into player_inventory and
// writes the permanent `runs` row. Called once the player has seen the
// results screen.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { id } = await params;
  const loaded = await loadActiveRun(id, player.id);
  if (!loaded) return NextResponse.json({ error: 'run not found' }, { status: 404 });
  if (loaded.state.status === 'active') {
    return NextResponse.json({ error: 'run has not ended yet' }, { status: 400 });
  }

  const result = await settleRun(loaded.row, loaded.state);
  return NextResponse.json(result);
}
