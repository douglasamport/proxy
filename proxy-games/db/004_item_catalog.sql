-- Item catalog lives in the DB, not code — unlike CFG.SURVEY/CFG.CLAIM_COST,
-- this is expected to be tuned directly (prices, new items) without a
-- deploy. Once seeded, this table is the only source of truth for an
-- item's cost/effects — nothing in lib/mining-engine.ts shadows it.
--
-- `effects` is a stat-name -> delta map (jsonb) rather than a single
-- number, because one item can touch multiple stats at once (a sensor
-- array affects range, blur, AND ping cost together) — see
-- lib/mining-inventory.ts for how these get summed into a Chassis.
create table item_catalog (
  item_key    text primary key,
  game        text not null,               -- 'mining' today — same scoping convention as runs.game
  category    text not null,               -- 'fuel' | 'cargo' | 'armour' | 'drive' | 'steer' | 'sensor' | 'analyser'
  label       text not null,
  description text,
  cost        numeric not null,
  effects     jsonb not null,
  active      boolean not null default true,  -- retire an item without deleting purchase history
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index item_catalog_game_idx on item_catalog(game);

-- Seed values match today's CFG per-unit constants exactly, so equipping
-- one Basic item is identical to one old-style allocation point — nothing
-- about existing run balance changes on day one. $1 each: placeholder for
-- testing, meant to be updated directly in this table, not in code.
insert into item_catalog (item_key, game, category, label, description, cost, effects) values
  ('fuel_basic',     'mining', 'fuel',     'Basic Fuel Tank',     'Adds to fuel capacity.',                 1, '{"fuelCap": 24}'),
  ('cargo_basic',    'mining', 'cargo',    'Basic Cargo Unit',    'Adds to cargo hold.',                     1, '{"hold": 5}'),
  ('armour_basic',   'mining', 'armour',   'Basic Armor Plate',   'Adds to sink (hazard tolerance).',        1, '{"sinkCap": 12}'),
  ('drive_basic',    'mining', 'drive',    'Basic Drive Train',   'Cheaper ground — raises speed.',          1, '{"speed": 0.20}'),
  ('steer_basic',    'mining', 'steer',    'Basic Steering Unit', 'Cheaper turns — raises movement.',        1, '{"movement": 0.22}'),
  ('sensor_basic',   'mining', 'sensor',   'Basic Sensor Array',  'Ping range, tighter fixes, cheaper pings.', 1, '{"sensorRange": 1.9, "sensorBlur": -0.38, "pingFuel": -0.35}'),
  ('analyser_basic', 'mining', 'analyser', 'Basic Analyzer',      'Narrows the grade estimate.',              1, '{"analyser": -0.8}');

-- One row per (player, item) — owned_quantity is total ever bought (minus
-- any future sell-back), equipped_quantity is what's currently slotted
-- into the active build. Equipping/unequipping only moves equipped_quantity
-- around; it never changes owned_quantity or touches the balance ledger —
-- you already paid for it, this is just deciding what's installed.
create table player_inventory (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null references players(id) on delete cascade,
  item_key          text not null references item_catalog(item_key),
  owned_quantity    int not null default 0,
  equipped_quantity int not null default 0,
  updated_at        timestamptz not null default now(),
  unique(player_id, item_key),
  check (equipped_quantity >= 0 and equipped_quantity <= owned_quantity)
);

create index player_inventory_player_idx on player_inventory(player_id);
