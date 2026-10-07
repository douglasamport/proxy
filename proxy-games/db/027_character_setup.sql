-- Character creation step: requestLogin() still auto-creates a placeholder
-- character row for every new player (energy/chassis hang off it), but the
-- player hasn't actually *made* one until they name it on the homepage.
-- setup_complete is that flag. Existing characters count as already set up.
alter table characters add column setup_complete boolean not null default false;
update characters set setup_complete = true;
