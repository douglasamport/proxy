-- Smashies rebuild, step 1 (see the foundation doc v2): sites replace the
-- bare `game` text column as the concept of "a place where an activity
-- happens." Purely additive — nothing reads this table yet, and the
-- existing game='mining'/'refine' columns across item_catalog,
-- player_inventory, active_proxy_selection, and runs are untouched. The
-- rekey onto site_id happens in a later pass, one file at a time, with
-- `game` left in place as a live fallback until everything's moved over
-- (see the sequencing discussion — this is a real DB in active use, not a
-- disposable copy, so nothing destructive happens until the very end).
--
-- site_category distinguishes sites with ownership/job economics
-- (`company`) from ones that are purely Authority-run (`municipal`) — the
-- Arena is seeded here for completeness even though nothing renders it
-- yet, so the three-row shape described in the doc exists from the start.
create table sites (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  activity_type       text not null check (activity_type in ('extraction', 'refining', 'arena')),
  site_category       text not null check (site_category in ('company', 'municipal')),
  owner_character_id  uuid references characters(id),
  created_at          timestamptz not null default now(),
  -- municipal sites have no owner and no job economics (see the doc) —
  -- enforce that at the schema level rather than trusting every reader to
  -- check site_category first.
  constraint sites_municipal_unowned check (
    site_category <> 'municipal' or owner_character_id is null
  )
);

insert into sites (name, activity_type, site_category, owner_character_id) values
  ('Mining Company', 'extraction', 'company', null),
  ('Refining Company', 'refining', 'company', null),
  ('The Arena', 'arena', 'municipal', null);
