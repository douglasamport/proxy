-- Sites must be unique by name — nothing enforced this at the DB level
-- (db/024_sites.sql just seeded three rows and trusted no one duplicates
-- them). lib/sites.ts's resolveSiteId() looks a site up by name, so a
-- duplicate would silently resolve to whichever row Postgres happens to
-- return first — this constraint turns that into a clean insert failure
-- instead.
alter table sites add constraint sites_name_uniq unique (name);
