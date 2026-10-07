-- Final cleanup, step 1 of 2 — NON-destructive prep. Run this FIRST: the app
-- code no longer writes the old `game` columns, and they are NOT NULL, so
-- inserts into runs / in_progress_runs / balance_transactions fail until
-- this has run. Nothing is dropped here.
--
-- 1. Backfill site_id on old rows that were written before site_id existed
--    in the code (game 'mining' -> Mining Company, 'refine' -> Refining
--    Company). land_clearing rows have no site and are removed in 031.
-- 2. Make `game` nullable so the new code can stop writing it.
begin;

update runs set site_id = (select id from sites where name = 'Mining Company')
  where site_id is null and game = 'mining';
update runs set site_id = (select id from sites where name = 'Refining Company')
  where site_id is null and game = 'refine';

update in_progress_runs set site_id = (select id from sites where name = 'Mining Company')
  where site_id is null and game = 'mining';
update in_progress_runs set site_id = (select id from sites where name = 'Refining Company')
  where site_id is null and game = 'refine';

update balance_transactions set site_id = (select id from sites where name = 'Mining Company')
  where site_id is null and game = 'mining';
update balance_transactions set site_id = (select id from sites where name = 'Refining Company')
  where site_id is null and game = 'refine';

alter table runs                 alter column game drop not null;
alter table in_progress_runs     alter column game drop not null;
alter table balance_transactions alter column game drop not null;

commit;
