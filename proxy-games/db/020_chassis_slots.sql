-- Metagame foundation, step 2 (see the Smashies/arena outline): generalize
-- the existing proxies/proxy_loadout scaffolding (built on the abandoned
-- land_clearing branch, never merged, never wired into any live code —
-- see the "proxies table" conversation) into the shared chassis/slot model
-- every game (mining, refine, arena, and land_clearing whenever it's
-- revisited) will build against.
--
-- proxies is kept as-is conceptually (a Proxy *is* a built-out chassis,
-- per the outline) but repointed from player_id to character_id, and its
-- two flat integer counters (slot_count, weapon_mounts) are replaced by
-- real chassis_slots rows — one row per slot — so a slot has an actual
-- identity ("slot 3 has this item in it") instead of being an aggregate
-- cap. proxy_loadout is dropped entirely: it was a quantity-counter per
-- (proxy, item_key), the same pooled-cap shape mining already has and the
-- arena outline is explicitly moving away from. Its 21 rows are land_
-- clearing prototype data with no other consumer; not migrated.

create table chassis_slots (
  id                 uuid primary key default gen_random_uuid(),
  proxy_id           uuid not null references proxies(id) on delete cascade,
  slot_type          text not null default 'standard'
                        check (slot_type in ('standard', 'carriage')),
  installed_item_id  text references item_catalog(item_key),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index chassis_slots_proxy_idx on chassis_slots(proxy_id);

-- One standard slot per unit of the old slot_count...
insert into chassis_slots (proxy_id, slot_type)
select p.id, 'standard'
from proxies p, generate_series(1, p.slot_count);

-- ...and one carriage slot per unit of the old weapon_mounts — weapon
-- mounts fold into the carriage class rather than staying a third,
-- special-cased slot category (per Douglas: "make weapons mount go into
-- the carriage class so it's not a generic slot").
insert into chassis_slots (proxy_id, slot_type)
select p.id, 'carriage'
from proxies p, generate_series(1, p.weapon_mounts)
where p.weapon_mounts > 0;

-- Both counters are now fully represented as real rows above — keeping
-- them as columns too would be a second source of truth for the same
-- number. Slot count going forward is just count(*) from chassis_slots.
alter table proxies drop column slot_count;
alter table proxies drop column weapon_mounts;

-- Re-point proxies and active_proxy_selection from player_id to
-- character_id (characters table added in db/019). Direct backfill, no
-- zero-downtime dance — small testing-only playerbase, same call made for
-- 019's own backfill.
alter table proxies add column character_id uuid references characters(id);
update proxies p set character_id = c.id
from characters c where c.player_id = p.player_id;
alter table proxies alter column character_id set not null;
alter table proxies drop column player_id;

alter table active_proxy_selection add column character_id uuid references characters(id);
update active_proxy_selection s set character_id = c.id
from characters c where c.player_id = s.player_id;
alter table active_proxy_selection alter column character_id set not null;
alter table active_proxy_selection drop column player_id;

drop table proxy_loadout;
