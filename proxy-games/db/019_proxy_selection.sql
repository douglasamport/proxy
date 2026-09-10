-- Which chassis is currently "in the field" for a given game. A proxy
-- itself has no game (see db/018_proxies.sql) — this is the only place a
-- game/proxy association is recorded, and it's a pointer, not ownership: a
-- player can own several proxies and flip which one is active per game
-- freely (refitting is still free — see lib/proxy-store.ts).
--
-- One row per (player, game). Backfilled below so every existing player's
-- one proxy becomes their active mining chassis, unchanged from today's
-- behavior. Any other game (land-clearing, etc.) has no row until the
-- player picks or is lazily given one — see getActiveProxy().
create table active_proxy_selection (
  player_id   uuid not null references players(id) on delete cascade,
  game        text not null,
  proxy_id    uuid not null references proxies(id) on delete cascade,
  updated_at  timestamptz not null default now(),
  primary key (player_id, game)
);

insert into active_proxy_selection (player_id, game, proxy_id)
select p.player_id, 'mining', p.id
from proxies p;
