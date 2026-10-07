-- The Mechanic: a company site that sells chassis and chassis upgrades.
--  * new activity_type 'mechanic' (sites + item_catalog checks extended)
--  * a seeded 'Mechanic' site (company, no owner yet)
--  * a 'chassis' catalog item (10,000, the price of a brand-new chassis)
--  * chassis_expansion and equipment_slot_unlock move from 'extraction' to
--    'mechanic', so they leave the mining store on their own
--  * the field equipment (ore siphon, line scanner) is sold at the Mechanic
--    too, but stays usable in extraction (fit on the Proxies page)
--  * players.starter_chassis_granted: every player gets exactly ONE free
--    chassis, once, at signup. Chassis are never created implicitly any
--    more, so scrapping one can't be farmed for credits.
-- Safe to re-run.
begin;

alter table sites drop constraint if exists sites_activity_type_check;
alter table sites add constraint sites_activity_type_check check (
  activity_type in ('extraction', 'refining', 'arena', 'mechanic')
);

alter table item_catalog drop constraint if exists item_catalog_activity_types_valid;
alter table item_catalog add constraint item_catalog_activity_types_valid check (
  cardinality(activity_types) > 0
  and activity_types <@ array['extraction', 'refining', 'arena', 'mechanic']
);

insert into sites (name, activity_type, site_category, owner_character_id)
select 'Mechanic', 'mechanic', 'company', null
where not exists (select 1 from sites where name = 'Mechanic');

insert into item_catalog
  (item_key, category, label, description, cost, effects, active, sellable, activity_types)
values
  ('chassis', 'chassis', 'Mining Chassis',
   'A new chassis with 10 standard slots.', 10000, '{}'::jsonb, true, false, array['mechanic'])
on conflict (item_key) do update
  set cost = excluded.cost, activity_types = excluded.activity_types;

update item_catalog set activity_types = array['mechanic']
  where item_key in ('chassis_expansion', 'equipment_slot_unlock');

update item_catalog set activity_types = array['extraction', 'mechanic']
  where category = 'equipment';

-- Existing players already had their chassis (or lost it to a reset);
-- none of them get a second free one. New signups are marked at creation.
alter table players add column if not exists starter_chassis_granted boolean not null default false;
update players set starter_chassis_granted = true;

commit;
