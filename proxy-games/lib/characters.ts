// Player -> Character resolution (see the Smashies/arena metagame outline
// and db/019_characters.sql). One Character per Player for MVP — the
// unique constraint on characters.player_id enforces that; nothing here
// assumes it, so lifting the constraint later is the only change needed
// for multi-Character support.
//
// Existing players were backfilled by db/019; this covers new signups
// going forward (called from requestLogin() in lib/auth.ts, same spot
// that already grants the starter kits).
import { sql } from "@/db/client";

export async function getOrCreateCharacter(
  playerId: string,
  fallbackName: string,
): Promise<string> {
  const [existing] = await sql`
    select id from characters where player_id = ${playerId}
  `;
  if (existing) return existing.id;

  const [created] = await sql`
    insert into characters (player_id, name)
    values (${playerId}, ${fallbackName})
    on conflict (player_id) do update set player_id = excluded.player_id
    returning id
  `;
  return created.id;
}
