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

export interface Character {
  id: string;
  name: string;
  setup_complete: boolean;
  created_at: string;
}

// Read-only lookup — unlike getOrCreateCharacter this never inserts.
export async function getCharacter(playerId: string): Promise<Character | null> {
  const [row] = await sql`
    select id, name, setup_complete, created_at
    from characters where player_id = ${playerId}
  `;
  return (row as Character) ?? null;
}

// Finishes character creation: names the (auto-created) character and
// flips setup_complete. No-op if already set up, so a double-submit can't
// rename an existing character.
export async function completeCharacterSetup(
  playerId: string,
  name: string,
): Promise<boolean> {
  await getOrCreateCharacter(playerId, name);
  const rows = await sql`
    update characters set name = ${name}, setup_complete = true
    where player_id = ${playerId} and not setup_complete
    returning id
  `;
  return rows.length > 0;
}
