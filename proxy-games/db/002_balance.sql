-- Persistent player currency, shared across every game in the shell — same
-- principle as runs.game: one balance, spendable anywhere, earned anywhere.
-- Pick up your stack at one table, sit down at another.

alter table players add column balance numeric not null default 0;

-- The ledger is the source of truth; players.balance is a fast-read cache
-- kept in sync with it (both written in the same transaction, see
-- app/api/runs/route.ts). `game` records where a transaction happened, not
-- which game "owns" the money — the balance itself is one shared pool.
create table balance_transactions (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references players(id) on delete cascade,
  game          text not null,               -- 'mining' today; open for the next one
  reason        text not null,               -- 'run_net' today; 'store_purchase' etc. later
  delta         numeric not null,            -- signed: positive credits, negative debits
  run_id        uuid references runs(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index balance_transactions_player_idx on balance_transactions(player_id, created_at desc);
