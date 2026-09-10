-- A Proxy is a player-owned chassis identity, independent of any single
-- game — like a hull in EVE: you build it once, then it can be fitted for
-- mining, land-clearing, war, whatever, by changing what's in proxy_loadout.
-- Nothing here assumes one-per-player forever; a player owning several
-- independently-fitted proxies (and a later cost to refit one) both layer
-- on top of this schema without another migration.
--
-- This is also the actual fix for the mining/refine equipped-slot leak:
-- the old bug was equipped state living in one player-wide pool
-- (player_inventory.equipped_quantity) with no per-chassis boundary, so a
-- refine part equipped anywhere summed straight into mining's slot cap.
-- Scoping equipped state to a specific proxy_id removes that leak
-- structurally — refine's furnace/vat/etc. were never chassis gear and are
-- deliberately never written into proxy_loadout (see backfill below).
create table proxies (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  name        text not null,
  slot_count  int not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index proxies_player_idx on proxies(player_id);

-- What's actually fitted on one specific chassis right now. Ownership
-- itself is unchanged — still player_inventory.owned_quantity, a shared
-- per-player hangar — this table only tracks what's installed, and where.
create table proxy_loadout (
  id                uuid primary key default gen_random_uuid(),
  proxy_id          uuid not null references proxies(id) on delete cascade,
  item_key          text not null references item_catalog(item_key),
  equipped_quantity int not null default 0,
  updated_at        timestamptz not null default now(),
  unique(proxy_id, item_key),
  check (equipped_quantity >= 0)
);

create index proxy_loadout_proxy_idx on proxy_loadout(proxy_id);

-- Backfill: one starting chassis per existing player. slot_count matches
-- whatever their mining capacity already was (base 10 + owned
-- chassis_expansion, same formula as getSlotTotal() in
-- lib/mining-inventory.ts) so nobody's effective cap changes on migration
-- day.
insert into proxies (player_id, name, slot_count)
select
  p.id,
  coalesce(p.display_name, 'Proxy') || '''s Chassis',
  10 + coalesce(exp.owned_quantity, 0)
from players p
left join player_inventory exp
  on exp.player_id = p.id and exp.item_key = 'chassis_expansion';

-- Backfill: carry over whatever was actually equipped for mining into that
-- new chassis's loadout. Refine's active parts are deliberately excluded —
-- they were never chassis gear, just leaking into the same
-- equipped_quantity pool by accident (the bug this table exists to fix).
insert into proxy_loadout (proxy_id, item_key, equipped_quantity)
select
  proxies.id,
  pi.item_key,
  pi.equipped_quantity
from player_inventory pi
join item_catalog ic on ic.item_key = pi.item_key
join proxies on proxies.player_id = pi.player_id
where ic.game = 'mining'
  and pi.equipped_quantity > 0;
