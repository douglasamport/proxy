-- Shared player identity + results, across every game in the shell.
-- `game` is a bare text column on purpose: adding game #2 costs zero
-- migrations, just a new value written into existing rows.

create extension if not exists pgcrypto;  -- gen_random_uuid()

create table players (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  display_name  text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

-- Single-use magic-link tokens. No passwords, ever — one less thing to
-- secure, one less reason someone abandons signup.
create table auth_tokens (
  token         text primary key,
  player_id     uuid not null references players(id) on delete cascade,
  expires_at    timestamptz not null,
  used_at       timestamptz
);

create index auth_tokens_player_idx on auth_tokens(player_id);

-- One row per completed run, from any game in the shell.
create table runs (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references players(id) on delete cascade,
  game          text not null,               -- 'mining' today; open for the next one
  seed          bigint not null,
  config        jsonb not null,              -- chassis/build snapshot at launch
  status        text not null,               -- banked | stranded | wrecked | ...
  units         int not null default 0,
  grade         numeric,
  net           numeric not null,
  move_log      jsonb not null,              -- seed + this = fully reproducible replay
  played_at     timestamptz not null default now()
);

create index runs_player_idx on runs(player_id, played_at desc);
create index runs_leaderboard_idx on runs(game, seed, net desc);

-- Session cookie -> player, kept server-side so a stolen cookie can be revoked
-- without touching auth_tokens.
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references players(id) on delete cascade,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);

create index sessions_player_idx on sessions(player_id);
