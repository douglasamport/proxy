import { NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { applyActiveAction } from '@/lib/land-clearing-run-store';
import { fight } from '@/lib/land-clearing-engine';
import type { FightTarget } from '@/lib/land-clearing-engine';

// POST { weapon_index, target_id } for a single-target weapon, or
// { weapon_index, x, y } for an AoE weapon (aoeRadius > 0) — see
// Weapon/fight() in lib/land-clearing-engine.ts. -> { view, events, err? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const weaponIndex = body.weapon_index;
  if (typeof weaponIndex !== 'number' || !Number.isInteger(weaponIndex) || weaponIndex < 0) {
    return NextResponse.json({ error: 'invalid weapon' }, { status: 400 });
  }

  let target: FightTarget;
  if (typeof body.target_id === 'number' && Number.isInteger(body.target_id)) {
    target = { targetId: body.target_id };
  } else if (
    typeof body.x === 'number' && Number.isInteger(body.x) &&
    typeof body.y === 'number' && Number.isInteger(body.y)
  ) {
    target = { x: body.x, y: body.y };
  } else {
    return NextResponse.json({ error: 'invalid target' }, { status: 400 });
  }

  const result = await applyActiveAction(id, player.id, (s) => fight(s, weaponIndex, target));
  if (result.kind === 'not_found') return NextResponse.json({ error: 'run not found' }, { status: 404 });
  if (result.kind === 'conflict') return NextResponse.json({ error: 'conflicting request, retry' }, { status: 409 });
  return NextResponse.json({ view: result.view, events: result.events, err: result.err });
}
