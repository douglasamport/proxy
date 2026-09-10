import { NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { applyActiveAction } from '@/lib/land-clearing-run-store';
import { extract } from '@/lib/land-clearing-engine';

// POST {} -> { view, err? } — voluntary early exit, banks whatever's
// already been salvaged.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { id } = await params;
  const result = await applyActiveAction(id, player.id, extract);
  if (result.kind === 'not_found') return NextResponse.json({ error: 'run not found' }, { status: 404 });
  if (result.kind === 'conflict') return NextResponse.json({ error: 'conflicting request, retry' }, { status: 409 });
  return NextResponse.json({ view: result.view, events: result.events, err: result.err });
}
