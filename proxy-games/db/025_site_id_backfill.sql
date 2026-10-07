-- Smashies rebuild, step 2a: add site_id everywhere `game` currently scopes
-- a row, and backfill it. Purely additive — `game` is left in place and
-- still authoritative for every existing read/write path; nothing in the
-- app reads site_id yet. This is deliberately its own migration, separate
-- from moving any code over, because this is a live DB with a running dev
-- server, not a disposable copy — see the sequencing discussion. Once
-- every call site has been moved onto site_id (tracked file by file), a
-- final migration drops the `game` columns.
--
-- Only 'mining' and 'refine' map to a real site today. Leftover rows from
-- the abandoned land_clearing branch (item_catalog, active_proxy_selection,
-- balance_transactions, runs) and one stray active_proxy_selection row with
-- game='expand' (predates this rebuild, not a real game value) get no
-- site_id — there's nothing to point them at, and nothing reads them via
-- the new column so leaving them null is harmless.
alter table item_catalog add column site_id uuid references sites(id);
alter table active_proxy_selection add column site_id uuid references sites(id);
alter table balance_transactions add column site_id uuid references sites(id);
alter table in_progress_runs add column site_id uuid references sites(id);
alter table runs add column site_id uuid references sites(id);

update item_catalog set site_id = s.id
from sites s where s.name = 'Mining Company' and item_catalog.game = 'mining';
update item_catalog set site_id = s.id
from sites s where s.name = 'Refining Company' and item_catalog.game = 'refine';

update active_proxy_selection set site_id = s.id
from sites s where s.name = 'Mining Company' and active_proxy_selection.game = 'mining';
update active_proxy_selection set site_id = s.id
from sites s where s.name = 'Refining Company' and active_proxy_selection.game = 'refine';

update balance_transactions set site_id = s.id
from sites s where s.name = 'Mining Company' and balance_transactions.game = 'mining';
update balance_transactions set site_id = s.id
from sites s where s.name = 'Refining Company' and balance_transactions.game = 'refine';

update in_progress_runs set site_id = s.id
from sites s where s.name = 'Mining Company' and in_progress_runs.game = 'mining';
update in_progress_runs set site_id = s.id
from sites s where s.name = 'Refining Company' and in_progress_runs.game = 'refine';

update runs set site_id = s.id
from sites s where s.name = 'Mining Company' and runs.game = 'mining';
update runs set site_id = s.id
from sites s where s.name = 'Refining Company' and runs.game = 'refine';

create index item_catalog_site_idx on item_catalog(site_id);
create index active_proxy_selection_site_idx on active_proxy_selection(site_id);
create index balance_transactions_site_idx on balance_transactions(site_id);
create index in_progress_runs_site_idx on in_progress_runs(site_id);
create index runs_site_idx on runs(site_id);
