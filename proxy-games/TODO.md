# TODO

## LAUNCH — target Friday (start inviting players)
Building (must-haves before inviting anyone):
- [x] **Mechanic site + multi-chassis + proxy management** — built on branch `mechanic-and-chassis`, see the section below. **Run `db/032_mechanic.sql`, then click through.**
- [ ] **Splash page for signed-out visitors** — `Welcome` currently just redirects to `/login`. Needs a public landing page: what the game is, a sign-in / "request access" path. The copy already drafted in `public/copy.ts` (`welcomeHeader`, `welcomeMessage`, `whatThisIs`) is a starting point (it still mentions "the games"; update for the current shape).
- [ ] **Real welcome message** on the signed-in homepage (replace the placeholder news in `components/Welcome.tsx`).
- [ ] **Sort out Store and Surveyor** — the Mechanic is done (above); the mining store and Surveyor still need extracting into their own sites (details under Next up below). The current store is just "the mining store"; there is no separate parts store.
- [ ] **Onboarding** — first-time flow after the magic link: create character -> make sure the starter kit is actually installed and the chassis is usable -> a short "do this first" guide (first run, first sale, where things are). Decide what a brand-new player sees on the Sidebar/homepage before their first run.
- [ ] **Art** (Douglas) — item images without backgrounds; logo.

Also before inviting:
- [x] Production env vars set (`DATABASE_URL`, `EMAIL_*`) — confirmed; magic-link sign-in already works for outside testers
- [ ] **Launch guard**: refuse to launch a run with `fuelCap = 0` (clear message instead of a run that strands on the first move)
- [ ] **Sign-up policy**: decide open sign-up vs an invite list (currently anyone with an email can sign up)
- [ ] **Feedback / bug reports**: a way for players to reach you from inside the game
- [ ] **End-to-end pass** on a brand-new account: sign up -> create character -> first run -> sell -> refine
- [ ] **Fresh database backup** right before sending invites (take a new Neon snapshot; the existing one predates new players, and the project's history retention is only 6h)

## Mechanic & chassis (built, branch `mechanic-and-chassis`; needs `db/032_mechanic.sql` + click-through)
Decisions: new chassis 10,000 credits (10 standard slots, player names it, no cap); slot upgrades double from 2K (2K, 4K, 8K, 16K, ...) priced from that chassis's real slots; equipment bay 25K, one per chassis; field equipment (ore siphon, line scanner) buy/sell at the Mechanic; scrap pays (total slots / 2) x 1,000; scrapping unassigns the chassis and its gear returns to inventory; you CAN scrap your last chassis; every player gets ONE free starter chassis at signup, recorded as `players.starter_chassis_granted` (no implicit chassis creation anywhere, so scrap can't be farmed); gear is one shared pool across all chassis; a chassis is assigned per activity (extraction now; refining + arena greyed out until they use proxies).
- [x] `db/032_mechanic.sql`: `mechanic` activity type + site (company, no owner), `chassis` catalog item (10K), expansion/bay moved to `mechanic`, equipment is `{extraction, mechanic}`, `players.starter_chassis_granted`
- [x] `lib/mechanic.ts` + `POST /api/mechanic` (buy-chassis, expand, equipment-bay, buy-item, sell-item) and `POST /api/chassis` (rename, assign, scrap); every action targets ONE chassis by id and checks ownership
- [x] Mechanic site page (`app/site/[siteId]/_mechanic`, `components/MechanicShop.tsx`); Sidebar + SiteShell know the `mechanic` type
- [x] `/proxies` reworked: all chassis, rename, assignment checkboxes, equip any chassis, scrap with confirm, stats per chassis
- [x] Equip API validates the slot belongs to any of your chassis (not just the active one); launch refuses with a clear message if no chassis is assigned (409) or `fuelCap = 0` (422)
- [x] Mining store no longer sells expansion / equipment bay / equipment; expansion + bay code removed from `CatalogScreen`; old `/api/store/expand` and `/api/store/equipment-slot` deleted
- [ ] Apply `db/032_mechanic.sql`, then click through: buy a chassis, add a slot, buy the bay, buy/sell equipment, rename, assign, fit gear on a non-active chassis, scrap, launch with/without a chassis
- [ ] Mechanic ledger rows record the Mechanic site (chassis purchase, slots, bay, equipment trades) — verify in `balance_transactions`
- [ ] **Jobbing at the mine**: a last-resort way to earn credits (e.g. a player who scrapped their only chassis and can't afford a new one). Not built.
- [ ] Refining and arena use of proxies (assignment boxes are greyed out until they do)
- [ ] **Chassis selection should be a dropdown** — on `/proxies` the chassis picker is currently a row of buttons (`components/ProxyManager.tsx`); switch it to a dropdown so it scales to many chassis. (Likely the same for the Mechanic page's chassis list if it gets long.)

## Next up (also feeds the launch list)
- [ ] **Header**: strip the balance/energy user bar out of `components/Header.tsx` (the Sidebar shows both now)
- [ ] **Extract Surveyor** out of the mining site into its own site (its own company type). Needs a new `activity_type` value + seed row, and the `sites.activity_type` check constraint (db/024) extended. `purchaseSurvey`'s ledger row should then record the Surveyor's site.
- [ ] **Extract Store** out of the mining site into its own site (municipal; same constraint + seed work). Store purchases / sales / chassis expansions / equipment-slot unlocks in `lib/mining-inventory.ts` currently leave `balance_transactions.site_id` null (decided); have them record the Store site then.
- [ ] **Images**: re-create with no backgrounds
- [ ] **Character page**: the Sidebar's Character link points at `/` until one exists. Run history is available from `GET /api/runs?siteId=` (no caller yet).
- [ ] **Welcome / homepage**: news is placeholder text (`components/Welcome.tsx`); needs a real source.
- [ ] **CatalogScreen layout**: confirm the one-item-per-row `ItemCard` is paired with the single-column grid in `CatalogScreen.tsx` (you were making that edit yourself).

## Maybe / small
- [ ] Launch guard: refuse to launch a mining run when the chassis has `fuelCap = 0` (an empty chassis strands on the first move; found when a reset character had no gear installed). Gameplay call, not decided.
- [ ] `CatalogScreen` still sends `activityType` in the `/api/store/buy` body; the route ignores it now.
- [ ] Delete the Neon snapshot `snap-autumn-hill-avcl4jm6` ("pre-final-cleanup-2026-10-07") in the Neon console once you're confident (project `neon-proxy-mine`, branch `main`; history retention there is only 6h).
- [ ] Rename `active_proxy_selection_character_game_uniq` (index/constraint still says "game").

## Architecture decisions (reference)
- **One vocabulary: `activity_type`** — `extraction`, `refining`, `arena` (more later: `combat`, `land_clearing` rebuilt from scratch, ...). Used by `sites`, `item_catalog.activity_types`, and `active_proxy_selection`.
- **Items**: `item_catalog.activity_types text[]` (a list; ore is `{extraction, refining}`). Queries use array overlap (`activity_types && ${list}::text[]`). Item lookups by `item_key` need no scope.
- **Proxies** are untyped (a chassis isn't bound to an activity). `active_proxy_selection` is one row per `(character_id, activity_type)`; the same proxy may be selected for several activities.
- **Runs** are scoped by `site_id`, one active run per player per site (a run is resumable saved state). The site id comes from the route (`siteId`, validated with `getSite` + activity type). Run-by-id routes need no site (id + player is enough).
- **No leaderboard**; build fresh if wanted later.
- `balance_transactions.site_id` is nullable on purpose (see Store extraction above); `runs.site_id` and `in_progress_runs.site_id` are NOT NULL.

## Done
- Sidebar (balance, energy, character link, inventory link, sites list) in the root layout; Welcome component (login gate, character creation, character readout, placeholder news); `db/027_character_setup.sql`
- Bridge removal: `resolveSiteId`, `GAME_TO_SITE_NAME`, `lib/site-activity.ts` and `ACTIVITY_TYPE_TO_GAME` are gone; `lib/sites.ts` is just `Site`, `getSite`, `listSites`
- `activity_type` unification across items, proxy selection, store/inventory routes and screens (`db/028`, `db/029`)
- Run/refine routes read + validate `siteId`; refine by-id loaders no longer need a site
- Final DB cleanup (`db/030`, `db/031`): `game` columns, `item_catalog.site_id`, `active_proxy_selection.site_id` and `runs_leaderboard_idx` dropped; land clearing removed entirely (35 items, 13 inventory rows, 1 chassis, 14 runs, 7 ledger rows)
- Leaderboard removed
