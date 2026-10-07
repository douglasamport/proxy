// Pure, DB-free split out of lib/sites.ts (same reasoning as
// lib/slot-categories.ts) — a client component (SiteShell) needs to map
// activity_type -> the old `game` slug, and importing lib/sites.ts itself
// would pull `@/db/client` into the browser bundle, which throws at
// import time with no DATABASE_URL available client-side.
export const ACTIVITY_TYPE_TO_GAME: Record<string, string> = {
  extraction: "mining",
  refining: "refine",
};
