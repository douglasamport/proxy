-- Metagame foundation, step 2b: give every character a real mining proxy
-- on the chassis_slots model, carrying over their actual current build
-- (see lib/mining-inventory.ts's player_inventory.equipped_quantity /
-- pooled-cap system, which this replaces for mining). Per Douglas:
-- carriage slots are for 'equipment'-category items and the future
-- proxy-weapon class; everything else (fuel/cargo/armour/drive/steer/
-- sensor/analyser) is standard. CFG.SLOT_TOTAL (10) is duplicated here as
-- a literal, same tradeoff scripts/autopilot-sweep.mts already accepts for
-- staying dependency-free.
--
-- One row per character per game, kept unique going forward — the
-- existing active_proxy_selection rows had no such constraint (leftover
-- from the abandoned land_clearing branch); application code doing a real
-- upsert needs one.
alter table active_proxy_selection
  add constraint active_proxy_selection_character_game_uniq unique (character_id, game);

-- Every character gets exactly one new mining proxy, regardless of
-- whether they already own unrelated (land_clearing-era) proxies.
insert into proxies (character_id, name)
select id, 'Mining Chassis' from characters;

-- Standard slots: 10 base + however many chassis_expansion units this
-- character's player_inventory shows owned today (mirrors getSlotTotal()).
insert into chassis_slots (proxy_id, slot_type)
select p.id, 'standard'
from characters c
join proxies p on p.character_id = c.id and p.name = 'Mining Chassis'
cross join lateral generate_series(1, 10 + coalesce((
  select owned_quantity from player_inventory pi
  where pi.player_id = c.player_id and pi.item_key = 'chassis_expansion'
), 0)) as gs(n);

-- Carriage slots: however many equipment_slot_unlock units are owned
-- today (mirrors getEquipmentSlotTotal() — 0 or 1 for every character
-- right now, but not assumed to stay capped at 1 going forward).
insert into chassis_slots (proxy_id, slot_type)
select p.id, 'carriage'
from characters c
join proxies p on p.character_id = c.id and p.name = 'Mining Chassis'
cross join lateral generate_series(1, coalesce((
  select owned_quantity from player_inventory pi
  where pi.player_id = c.player_id and pi.item_key = 'equipment_slot_unlock'
), 0)) as gs(n);

-- Fill standard slots from whatever's actually equipped today, outside
-- the 'equipment' category. Each equipped_quantity > 1 expands into that
-- many slot instances via generate_series, then a row_number match pairs
-- each item-instance to an empty slot on the same proxy — assignment
-- order doesn't matter, only that every equipped unit lands somewhere and
-- no slot gets two.
with equipped_expanded as (
  select p.id as proxy_id, pi.item_key,
         row_number() over (partition by p.id order by pi.item_key, gs.n) as rn
  from player_inventory pi
  join item_catalog ic on ic.item_key = pi.item_key and ic.game = 'mining'
  join characters c on c.player_id = pi.player_id
  join proxies p on p.character_id = c.id and p.name = 'Mining Chassis'
  cross join lateral generate_series(1, pi.equipped_quantity) as gs(n)
  where pi.equipped_quantity > 0 and ic.category <> 'equipment'
),
slots_numbered as (
  select cs.id as slot_id, cs.proxy_id,
         row_number() over (partition by cs.proxy_id order by cs.id) as rn
  from chassis_slots cs
  where cs.slot_type = 'standard'
)
update chassis_slots cs
set installed_item_id = ee.item_key, updated_at = now()
from equipped_expanded ee
join slots_numbered sn on sn.proxy_id = ee.proxy_id and sn.rn = ee.rn
where cs.id = sn.slot_id;

-- Same, for currently-equipped 'equipment' items into carriage slots (no
-- one has any equipped today, but the migration should be correct
-- regardless of that happening to be true right now).
with equipped_expanded as (
  select p.id as proxy_id, pi.item_key,
         row_number() over (partition by p.id order by pi.item_key, gs.n) as rn
  from player_inventory pi
  join item_catalog ic on ic.item_key = pi.item_key and ic.game = 'mining'
  join characters c on c.player_id = pi.player_id
  join proxies p on p.character_id = c.id and p.name = 'Mining Chassis'
  cross join lateral generate_series(1, pi.equipped_quantity) as gs(n)
  where pi.equipped_quantity > 0 and ic.category = 'equipment'
),
slots_numbered as (
  select cs.id as slot_id, cs.proxy_id,
         row_number() over (partition by cs.proxy_id order by cs.id) as rn
  from chassis_slots cs
  where cs.slot_type = 'carriage'
)
update chassis_slots cs
set installed_item_id = ee.item_key, updated_at = now()
from equipped_expanded ee
join slots_numbered sn on sn.proxy_id = ee.proxy_id and sn.rn = ee.rn
where cs.id = sn.slot_id;

-- Point every character's mining selection at their new proxy. Wipes any
-- existing 'mining' rows first (2 characters had one, pointing at
-- land_clearing-era prototype proxies — not real mining chassis).
delete from active_proxy_selection where game = 'mining';

insert into active_proxy_selection (character_id, game, proxy_id)
select c.id, 'mining', p.id
from characters c
join proxies p on p.character_id = c.id and p.name = 'Mining Chassis';

-- chassis_slots is now the source of truth for mining equip state —
-- zero out player_inventory.equipped_quantity for mining items so it
-- can't drift into a second, stale answer to "what's equipped". owned_
-- quantity (what a character actually owns) is untouched.
update player_inventory pi
set equipped_quantity = 0, updated_at = now()
from item_catalog ic
where ic.item_key = pi.item_key and ic.game = 'mining' and pi.equipped_quantity > 0;
