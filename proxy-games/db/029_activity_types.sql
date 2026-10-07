-- One vocabulary for "what kind of activity is this for": the values
-- sites.activity_type already uses — 'extraction', 'refining', 'arena'
-- (plus 'land_clearing', which the catalog already has items for from the
-- abandoned land_clearing branch; combat, ... later).
--
-- items: item_catalog.item_class (a single string) becomes
--   activity_types text[] — a list, so one item can serve several activities
--   (ore is dug by extraction and consumed by refining). Most items have a
--   one-element list.
-- proxies: deliberately NOT typed — a chassis isn't bound to an activity.
--   Which proxy a character uses for each activity is what
--   active_proxy_selection says, so its `game` column becomes activity_type
--   (same key, new name and values). The same proxy may be selected for
--   more than one activity.
-- The remaining `game` columns (runs, in_progress_runs, balance_transactions)
--   are redundant with the site's activity_type and are dropped in the final
--   cleanup.
--
-- Safe to re-run: every step is guarded, so if a previous run stopped partway
-- (e.g. at the NOT NULL below) running the whole file again finishes the job.

-- item_catalog
alter table item_catalog add column if not exists activity_types text[];

update item_catalog set activity_types = case item_class
  when 'mining'        then array['extraction']
  when 'refine'        then array['refining']
  when 'land_clearing' then array['land_clearing']
end
where activity_types is null;

update item_catalog set activity_types = array['extraction', 'refining']
  where category = 'ore';

-- Fails loudly if any item_class was something not mapped above.
alter table item_catalog alter column activity_types set not null;

alter table item_catalog drop constraint if exists item_catalog_activity_types_valid;
alter table item_catalog add constraint item_catalog_activity_types_valid check (
  cardinality(activity_types) > 0
  and activity_types <@ array['extraction', 'refining', 'arena', 'land_clearing']
);

drop index if exists item_catalog_game_idx;
alter table item_catalog drop column if exists item_class;
create index if not exists item_catalog_activity_types_idx
  on item_catalog using gin (activity_types);

-- active_proxy_selection (unique (character_id, game) carries over the rename)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'active_proxy_selection' and column_name = 'game'
  ) then
    alter table active_proxy_selection rename column game to activity_type;
  end if;
end $$;

update active_proxy_selection set activity_type = 'extraction' where activity_type = 'mining';
update active_proxy_selection set activity_type = 'refining'   where activity_type = 'refine';
