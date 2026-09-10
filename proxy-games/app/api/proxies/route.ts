import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/db/client';
import { currentPlayer } from '@/lib/auth';
import { createProxy, listProxies } from '@/lib/proxy-store';

// GET -> every chassis this player owns, across every game (a proxy has no
// game of its own — see db/018_proxies.sql), plus which one is currently
// active per game, so the picker UI can show current selection.
export async function GET() {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const [proxies, activeRows] = await Promise.all([
    listProxies(player.id),
    sql`select game, proxy_id from active_proxy_selection where player_id = ${player.id}`,
  ]);
  const active = Object.fromEntries(activeRows.map((r) => [r.game, r.proxy_id]));

  return NextResponse.json({ proxies, active });
}

// POST { name } -> the new Proxy. No cost yet — building a bare hull is
// free; gear and slot expansions are what cost credits.
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const proxy = await createProxy(player.id, name);
  return NextResponse.json({ proxy });
}
