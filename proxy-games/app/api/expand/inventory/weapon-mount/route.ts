import { NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { getActiveProxy, purchaseWeaponMountExpansion } from '@/lib/proxy-store';

const GAME = 'land_clearing';

// POST {} -> { balance, weaponMounts } | error
// Separate from POST /api/store/expand (the general chassis slot pool) —
// weapon mounts are their own pool, see db/022_weapon_mounts.sql.
export async function POST() {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const proxy = await getActiveProxy(player.id, GAME);
  const result = await purchaseWeaponMountExpansion(player.id, proxy.id, GAME);
  if (result.kind === 'not_found') return NextResponse.json({ error: 'weapon mount not available' }, { status: 404 });
  if (result.kind === 'insufficient_funds') return NextResponse.json({ error: 'insufficient funds' }, { status: 402 });

  return NextResponse.json({ balance: result.balance, weaponMounts: result.weaponMounts });
}
