import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { setActiveProxy } from '@/lib/proxy-store';

// POST { game, proxy_id } -> { ok: true } | error
// Sets which of the player's proxies is currently in the field for `game`.
// Refitting a chassis for a different game later is free for now — this
// is purely a pointer change, not a purchase.
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const game = body.game;
  const proxyId = body.proxy_id;
  if (typeof game !== 'string' || !game || typeof proxyId !== 'string' || !proxyId) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const result = await setActiveProxy(player.id, game, proxyId);
  if (result === 'not_owned') return NextResponse.json({ error: 'proxy not owned' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
