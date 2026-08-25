import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { sql } from '@/db/client';

const SESSION_COOKIE = 'sid';
const TOKEN_TTL_MIN = 15;
const SESSION_TTL_DAYS = 30;

export function newToken() {
  return randomBytes(24).toString('base64url');
}

// Step 1 of magic-link auth: create-or-fetch the player, issue a single-use
// token, return it so the caller can email it. We never learn or store a
// password — the emailed link IS the credential.
export async function requestLogin(email: string) {
  const normalised = email.trim().toLowerCase();

  const [player] = await sql`
    insert into players (email)
    values (${normalised})
    on conflict (email) do update set email = excluded.email
    returning id
  `;

  const token = newToken();
  const expires = new Date(Date.now() + TOKEN_TTL_MIN * 60_000);

  await sql`
    insert into auth_tokens (token, player_id, expires_at)
    values (${token}, ${player.id}, ${expires.toISOString()})
  `;

  return token;
}

// Step 2: the link lands here. Verify, burn the token, open a session.
export async function verifyToken(token: string) {
  const [row] = await sql`
    select player_id, expires_at, used_at
    from auth_tokens
    where token = ${token}
  `;

  if (!row) return null;
  if (row.used_at) return null;                       // one-time use
  if (new Date(row.expires_at) < new Date()) return null;

  await sql`update auth_tokens set used_at = now() where token = ${token}`;
  await sql`update players set last_seen_at = now() where id = ${row.player_id}`;

  const [session] = await sql`
    insert into sessions (player_id, expires_at)
    values (${row.player_id}, ${new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString()})
    returning id
  `;

  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_DAYS * 86_400,
    path: '/',
  });

  return row.player_id as string;
}

// Call this at the top of any route/page that needs to know who's logged in.
// Also stamps last_seen_at — this single line is the day-two-return metric.
export async function currentPlayer() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;

  const [row] = await sql`
    select p.id, p.email, p.display_name
    from sessions s
    join players p on p.id = s.player_id
    where s.id = ${sid} and s.expires_at > now()
  `;
  if (!row) return null;

  await sql`update players set last_seen_at = now() where id = ${row.id}`;
  return row as { id: string; email: string; display_name: string | null };
}

// Ends the current session: deletes the session row (so a copied/leaked
// cookie stops working immediately, not just on expiry) and clears the cookie.
export async function logout() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;

  if (sid) {
    await sql`delete from sessions where id = ${sid}`;
  }

  jar.delete(SESSION_COOKIE);
}
