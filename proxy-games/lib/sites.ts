import { sql } from "@/db/client";

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
// URL, so this has to tolerate "not found"
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
