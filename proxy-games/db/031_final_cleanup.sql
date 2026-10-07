-- Final cleanup, step 2 of 2 — DESTRUCTIVE. Run only after 030 and with the
-- new code in place (nothing reads or writes the dropped columns any more).
-- A Neon snapshot was taken first: snap-autumn-hill-avcl4jm6
-- (pre-final-cleanup-2026-10-07).
--
-- 1. Remove land clearing entirely (abandoned branch; rebuilt from scratch
--    later): its catalog items, anyone's inventory of them, its leftover
--    unselected proxy chassis, and its runs / ledger history. Balances are
--    untouched — players.balance already reflects every one of those rows.
-- 2. Drop the redundant columns: game on runs / in_progress_runs /
--    balance_transactions, site_id on item_catalog and active_proxy_selection,
--    plus the leaderboard index.
-- 3. runs.site_id and in_progress_runs.site_id become NOT NULL.
--    balance_transactions.site_id stays nullable on purpose (store purchases
--    don't record a site yet).
begin;

-- 1. land clearing -----------------------------------------------------
delete from balance_transactions where game = 'land_clearing';
delete from runs                 where game = 'land_clearing';
delete from in_progress_runs     where game = 'land_clearing';

delete from player_inventory
  where item_key in (
    select item_key from item_catalog where 'land_clearing' = any(activity_types)
  );

-- Refuse to continue if any land-clearing item is still installed in a slot.
do $$
begin
  if exists (
    select 1 from chassis_slots cs
    join item_catalog ic on ic.item_key = cs.installed_item_id
    where 'land_clearing' = any(ic.activity_types)
  ) then
    raise exception 'a land_clearing item is still installed in a chassis slot';
  end if;
end $$;

-- The one leftover land-clearing chassis: not selected anywhere, all slots empty.
delete from chassis_slots
  where proxy_id in (
    select p.id from proxies p
    where p.name = 'Proxy''s Chassis'
      and p.id not in (select proxy_id from active_proxy_selection)
  )
  and installed_item_id is null;
delete from proxies
  where name = 'Proxy''s Chassis'
    and id not in (select proxy_id from active_proxy_selection)
    and id not in (select proxy_id from chassis_slots);

delete from item_catalog where 'land_clearing' = any(activity_types);

-- 3. site_id must be filled before NOT NULL (fails loudly if 030 missed any)
do $$
begin
  if exists (select 1 from runs where site_id is null)
     or exists (select 1 from in_progress_runs where site_id is null) then
    raise exception 'runs / in_progress_runs still have null site_id — did 030 run?';
  end if;
end $$;
alter table runs             alter column site_id set not null;
alter table in_progress_runs alter column site_id set not null;

-- 2. drop redundant columns ---------------------------------------------
drop index if exists runs_leaderboard_idx;
alter table runs                 drop column game;
alter table in_progress_runs     drop column game;
alter table balance_transactions drop column game;

drop index if exists item_catalog_site_idx;
alter table item_catalog drop column site_id;

drop index if exists active_proxy_selection_site_idx;
alter table active_proxy_selection drop column site_id;

-- land_clearing is no longer a valid activity type for items
alter table item_catalog drop constraint if exists item_catalog_activity_types_valid;
alter table item_catalog add constraint item_catalog_activity_types_valid check (
  cardinality(activity_types) > 0
  and activity_types <@ array['extraction', 'refining', 'arena']
);

commit;
