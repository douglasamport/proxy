-- Metagame foundation, step 1 (see the Smashies/arena outline): a Character
-- sits between Player (permanent account identity) and the things that get
-- built/spent in-game (chassis, inventory, equipment). Nothing else moves
-- onto character_id yet — this migration only creates and backfills the
-- table. balance stays on players for now (players.balance/balance_
-- transactions untouched); chassis/inventory ownership repoints in the
-- next migration, once chassis_slots actually exists to repoint onto.
--
-- One row per player for MVP: the unique constraint on player_id enforces
-- "one Character per Player" today without precluding more later (drop the
-- constraint, no other schema change needed — see the outline's Open
-- Questions section).
create table characters (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null unique references players(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Backfill: one character per existing player. display_name may be null
-- (magic-link signup never required one) — fall back to the email's local
-- part so every character gets a usable name.
insert into characters (player_id, name)
select id, coalesce(display_name, split_part(email, '@', 1))
from players;
