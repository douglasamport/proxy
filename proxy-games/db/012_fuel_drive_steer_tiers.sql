-- Stage 4 of build-spec-ore-progression.md, as discussed: no separate "fuel
-- types" axis and no efficiency-only "drive tier" mechanic — instead, drive/
-- steer/fuel each get two stronger, pricier tiers as ordinary item_catalog
-- rows, same shape as the existing *_basic items (slot-competing, additive,
-- no dependency between tiers). No consumables this stage.
--
-- fuelEfficiency is the one new stat: a fractional discount on movement,
-- digging, and turning (NOT ping — see fuelMult() in lib/mining-engine.ts).
-- fuel_basic stays capacity-only; the efficiency line only starts at
-- fuel_t3 (6%) — fuel_t2 is capacity only, matching the "level 1 = more
-- capacity, level 2 = more capacity + efficiency" shape asked for.

insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('drive_t2', 'mining', 'drive', 'Drive Train II', 'More speed than the basic drive train.', 3600, '{"speed": 0.35}', true, 0.5),
  ('drive_t3', 'mining', 'drive', 'Drive Train III', 'Significantly more speed — a second haul at full depth.', 9000, '{"speed": 0.55}', true, 0.5),
  ('steer_t2', 'mining', 'steer', 'Steering Unit II', 'More movement than the basic steering unit.', 3000, '{"movement": 0.38}', true, 0.5),
  ('steer_t3', 'mining', 'steer', 'Steering Unit III', 'Significantly cheaper turns.', 7500, '{"movement": 0.60}', true, 0.5),
  ('fuel_t2',  'mining', 'fuel',  'Fuel Cell II',  'More fuel capacity than the basic tank.', 2200, '{"fuelCap": 45}', true, 0.5),
  ('fuel_t3',  'mining', 'fuel',  'Fuel Cell III', 'More fuel capacity, and burns leaner across the board.', 6000, '{"fuelCap": 70, "fuelEfficiency": 0.06}', true, 0.5);
