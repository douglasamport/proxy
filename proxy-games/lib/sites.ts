// Bridge between the old `game` string scoping and the new `sites` table
// (see db/024_sites.sql, db/025_site_id_backfill.sql, and the Smashies
// rebuild foundation doc) while call sites still pass `game` around. Once
// every caller is moved onto site_id directly, this — and the `game`
// column it's mapping from — goes away.
import { sql } from "@/db/client";
export { ACTIVITY_TYPE_TO_GAME } from "./site-activity";

const GAME_TO_SITE_NAME: Record<string, string> = {
  mining: "Mining Company",
  refine: "Refining Company",
};

// Sites are fixed seed data (three rows, never renamed at runtime) — cache
// each resolution for the life of the process instead of a DB round trip
// on every call, same tradeoff as any other rarely-changing lookup table.
const cache = new Map<string, Promise<string>>();

export function resolveSiteId(game: string): Promise<string> {
  let cached = cache.get(game);
  if (!cached) {
    const name = GAME_TO_SITE_NAME[game];
    if (!name) throw new Error(`no site mapped for game '${game}'`);
    cached = sql`select id from sites where name = ${name}`.then((rows) => {
      const row = rows[0];
      if (!row) throw new Error(`site '${name}' not seeded`);
      return row.id as string;
    });
    cache.set(game, cached);
  }
  return cached;
}

export interface Site {
  id: string;
  name: string;
  activity_type: string;
  site_category: string;
  owner_character_id: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// For the site routes (app/site/[siteId]/*) — id comes straight from the
// URL, so unlike resolveSiteId() above this has to tolerate "not found"
// (a bad/stale link, or just a non-uuid string typed into the address bar)
// rather than throwing — a malformed uuid literal would otherwise fail the
// query itself instead of cleanly returning null for the route to 404 on.
export async function getSite(siteId: string): Promise<Site | null> {
  if (!UUID_RE.test(siteId)) return null;
  const [row] = await sql`
    select id, name, activity_type, site_category, owner_character_id
    from sites where id = ${siteId}
  `;
  return (row as Site) ?? null;
}

export async function listSites(): Promise<Site[]> {
  const rows = await sql`
    select id, name, activity_type, site_category, owner_character_id
    from sites order by name
  `;
  return rows as Site[];
}
