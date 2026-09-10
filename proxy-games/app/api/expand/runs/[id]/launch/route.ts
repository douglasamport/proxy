import { NextResponse } from 'next/server';
import { sql } from '@/db/client';
import { currentPlayer } from '@/lib/auth';
import { loadFittingRun, toPublicView } from '@/lib/land-clearing-run-store';
import { computeChassis, loadoutSnapshot } from '@/lib/land-clearing-inventory';
import { getActiveProxy } from '@/lib/proxy-store';
import { createRun } from '@/lib/land-clearing-engine';

const GAME = 'land_clearing';

// POST {} -> the initial PublicRunView for the run. Chassis stats are
// computed server-side from whatever's actually fitted on the player's
// active land-clearing proxy — see app/api/expand/inventory/equip.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { id } = await params;
  const row = await loadFittingRun(id, player.id);
  if (!row) return NextResponse.json({ error: 'run not found' }, { status: 404 });

  const proxy = await getActiveProxy(player.id, GAME);
  const [chassis, loadout] = await Promise.all([
    computeChassis(proxy.id),
    loadoutSnapshot(proxy.id),
  ]);
  const state = createRun(row.seed, chassis);

  const [saved] = await sql`
    update in_progress_runs
    set phase = 'active', loadout = ${JSON.stringify(loadout)}::jsonb,
        state = ${JSON.stringify(state)}::jsonb, updated_at = now()
    where id = ${id} and player_id = ${player.id} and phase = 'fitting'
    returning id
  `;
  if (!saved) return NextResponse.json({ error: 'run already launched' }, { status: 409 });

  return NextResponse.json(toPublicView(id, state));
}
