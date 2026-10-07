- Images. Need to be re-createed with no backgrounds
- Extract Surveyor out of the mining site into its own site (its own company type)
- Extract Store out of the mining site into its own site (municipal)

## Remove the `game` -> site bridge (resolveSiteId / ACTIVITY_TYPE_TO_GAME)

Goal: nothing calls `resolveSiteId`; `lib/site-activity.ts` is deleted; `lib/sites.ts` keeps only `Site`, `getSite`, `listSites`.
Plan: one file at a time, decided by hand. Each item says what it does today; "decide" = open question.

### Direction decided so far
- Items are scoped by **`item_class`** ('mining', 'refine', ...), not by site. A site can have many instances (private mines), so item lookups must not depend on a site id.
- Catalog/inventory reads take an optional class filter (omit = everything). Item lookups by `item_key` need no scope (it's unique).

### Done
- [x] Header: removed hard-coded `resolveSiteId` links (Sidebar replaces them)
- [x] `/inventory` page: stays; now calls `loadCatalog()` / `loadInventory(player.id)` with no class (shows all classes)
- [x] `db/027_character_setup.sql` applied (characters.setup_complete)
- [x] `db/028_item_class.sql` applied (item_catalog.game -> item_class)
- [x] `lib/mining-inventory.ts`: no site ids left (catalog/inventory by class, items by key). Side effect: its `balance_transactions` inserts write `game` but leave `site_id` null — decide whether the ledger should record a site (see Ledger below)

### A. Item catalog / inventory -> `item_class` (still reading `item_catalog.site_id`)
- [ ] `lib/refine-inventory.ts:109` `computeRefineEffects` — joins `ic.site_id`; switch to class (or drop the filter)
- [ ] `lib/refine-inventory.ts:230` `setActivePart` — `ic.site_id` at lines 235 and 243; switch to class
- [ ] `lib/refine-inventory.ts:4` stale comment mentions `loadCatalog(game)`
- [ ] Once nothing reads it: drop `item_catalog.site_id` (see Final DB cleanup)

### B. Runs / in-progress runs / proxies — decide: scope by site instance, or by game/class?
A run really does happen at a specific site, so `site_id` may be correct here; the open question is where the id comes from (route param instead of `resolveSiteId(game)`).
- [ ] `lib/mining-run-store.ts:363` active-run lookup by `site_id`
- [ ] `lib/mining-run-store.ts:388` fitting-run create/delete by `site_id`
- [ ] `lib/mining-run-store.ts:430` `purchaseSurvey` ledger insert (site_id) — also Surveyor extraction
- [ ] `lib/mining-run-store.ts:302-339` settle writes `runs` and ledger rows from the stored row's site_id (already fine; just don't regress)
- [ ] `lib/refine-batch-store.ts:57` fitting lookup
- [ ] `lib/refine-batch-store.ts:70` active-by-id lookup (id already unique; site filter may be unnecessary)
- [ ] `lib/refine-batch-store.ts:109` fitting create/delete
- [ ] `lib/refine-batch-store.ts:341` active lookup
- [ ] `lib/refine-batch-store.ts:274` reads `sell_value` from item_catalog by key (no site; fine)
- [ ] `lib/proxies.ts:35` `getOrCreateActiveProxy(characterId, game, ...)` — `active_proxy_selection` keyed `(character_id, game)` with `site_id`; decide: one active proxy per class, or per site? (private mines make this matter)

### C. API routes that call `resolveSiteId(game)`
- [ ] `app/api/runs/route.ts:26` run history filtered by game -> site
- [ ] `app/api/runs/current/route.ts:35` current run by game -> site
- [ ] `app/api/refine/current/route.ts:23` current refine batch (hard-coded `GAME`)
- [ ] `app/api/leaderboard/[game]/[seed]/route.ts:21` path segment is `[game]`; decide whether leaderboard is per site or per class
- [ ] `app/api/inventory/route.ts` takes `?game=` and passes it straight through as the class — rename param to `class` (or leave)
- [ ] `app/api/store/{buy,sell,expand,equipment-slot}/route.ts` still pass `game` into mining-inventory (used only as ledger label now)

### D. Client side
- [ ] `components/game-shell/SiteShell.tsx:15,52` maps `activityType` -> `game` via `ACTIVITY_TYPE_TO_GAME`; use `activity_type` directly
- [ ] `lib/site-activity.ts`: delete once SiteShell stops importing it
- [ ] `app/site/[siteId]/_refine/RefineBatchScreen.tsx:130` fetches `/api/inventory?game=refine`
- [ ] `app/site/[siteId]/_mining/MiningRunScreen.tsx:189` fetches `/api/inventory?game=mining`
- [ ] `components/game-shell/InventoryContext.tsx` has a `game` prop (class) — rename if the param is renamed
- [ ] Screens under `_mining/` and `_refine/` that call run/lease APIs: pass the route's `siteId` if section B/C needs it

### E. Remove the bridge itself (last)
- [ ] `lib/sites.ts`: delete `resolveSiteId`, `GAME_TO_SITE_NAME`, the cache, and the `ACTIVITY_TYPE_TO_GAME` re-export

### Ledger (decide)
- [ ] `balance_transactions.site_id`: new rows from mining-inventory leave it null. Either pass a site id into those functions or stop using the column

### Final DB cleanup (destructive, last)
- [ ] Drop `item_catalog.site_id`
- [ ] Decide fate of `game` and `site_id` on `runs`, `in_progress_runs`, `active_proxy_selection`, `balance_transactions` (make `site_id` NOT NULL, or drop `game`) — see db/024 header

### After the bridge
- [ ] Extract Surveyor and Store into their own sites (new `activity_type` values + seed rows), so they never need a bridge entry
