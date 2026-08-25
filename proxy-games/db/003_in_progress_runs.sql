-- Server-authoritative live run state. The client sends intent only
-- (direction / extract / ping); the server loads this row, runs the pure
-- engine function against it, saves the result, and returns a redacted view.
-- Deleted once a run ends and its result is written to the permanent `runs`
-- table.
--
-- `state` holds the full live RunState (position, fuel, sink, cells,
-- contacts, log — everything lib/mining-engine.ts's RunState type has) as
-- jsonb, only once phase='active'. `seed` is never sent to the client while
-- a row exists here — that's the entire point of this table.
create table in_progress_runs (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references players(id) on delete cascade,
  game          text not null,
  seed          bigint not null,
  phase         text not null default 'fitting',   -- 'fitting' | 'active'
  alloc         jsonb,                              -- set at launch, after server-side validation
  claim         int,                                -- set at launch
  survey        text not null default 'none',       -- set at launch
  state         jsonb,                               -- full RunState, set at launch, updated per move/extract/ping
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index in_progress_runs_player_idx on in_progress_runs(player_id);
