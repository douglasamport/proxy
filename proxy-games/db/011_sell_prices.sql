-- Buy/sell pricing for item_catalog — the schema Stage 5's survey store
-- reads directly, so it doesn't need another migration when it goes live.
-- See build-spec-ore-progression.md, Stage 3.
alter table item_catalog add column sellable boolean not null default false;
-- Ore's sell_value is a flat price in credits, independently stored.
-- Everything else's sell_value is a RATIO of that row's own `cost` (0.5 =
-- sells back at 50%) — same two columns, two different rules depending on
-- category (see lib/mining-inventory.ts and settleRun() in
-- lib/mining-run-store.ts for the ore side).
alter table item_catalog add column sell_value numeric;

-- Copper's sell price is the anchor: CFG.ORE_PRICE (6.5), unchanged from
-- what "Collect credits" has always paid per raw grade-value point (see
-- score() in lib/mining-engine.ts) — so a run banked as ore and later sold
-- back at this price is worth exactly what collecting credits would have
-- paid. Every other ore's sell price is 6.5 × that ore's value_multiplier
-- from the Stage 1 taxonomy table. Buy price is sell price × a per-tier
-- markup (1.2 / 2 / 10 / 100) — rare earth's is deliberately punishing.
update item_catalog set cost = 7.8,    sell_value = 6.5,   sellable = true where item_key = 'copper';
update item_catalog set cost = 11.7,   sell_value = 9.75,  sellable = true where item_key = 'zinc';
update item_catalog set cost = 15.6,   sell_value = 13,    sellable = true where item_key = 'iron';
update item_catalog set cost = 65,     sell_value = 32.5,  sellable = true where item_key = 'silver';
update item_catalog set cost = 104,    sell_value = 52,    sellable = true where item_key = 'gold';
update item_catalog set cost = 156,    sell_value = 78,    sellable = true where item_key = 'platinum';
update item_catalog set cost = 1300,   sell_value = 130,   sellable = true where item_key = 'silica';
update item_catalog set cost = 1820,   sell_value = 182,   sellable = true where item_key = 'germanium';
update item_catalog set cost = 2275,   sell_value = 227.5, sellable = true where item_key = 'cadmium';
update item_catalog set cost = 39000,  sell_value = 390,   sellable = true where item_key = 'neodymium';
update item_catalog set cost = 52000,  sell_value = 520,   sellable = true where item_key = 'yttrium';
update item_catalog set cost = 65000,  sell_value = 650,   sellable = true where item_key = 'lanthanum';
update item_catalog set cost = 84500,  sell_value = 845,   sellable = true where item_key = 'tantalum';

-- Components sell back at 50% of purchase price — sell_value stored as the
-- ratio (0.5), not a flat number, since it tracks whatever `cost` happens
-- to be for that row.
update item_catalog set sellable = true, sell_value = 0.5
  where item_key in (
    'fuel_basic', 'cargo_basic', 'armour_basic', 'drive_basic', 'steer_basic',
    'sensor_basic', 'analyser_basic', 'ore_siphon', 'line_scanner'
  );

-- chassis_expansion and equipment_slot_unlock are permanent, one-time
-- gates — a sold slot would be indistinguishable from an unpurchased one
-- and corrupt their respective doubling-cost / one-time-gate logic (see
-- lib/mining-inventory.ts). Left at the column defaults: not sellable, no
-- sell_value.
