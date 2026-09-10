-- Ranged weapons — a second weapon category alongside 'weapon' (melee).
-- Both grant 'attack'; only these also grant 'range', which is what lets
-- fight() reach past adjacent (see StatKey/Chassis.range and BASE_RANGE in
-- lib/land-clearing-engine.ts). Priced the same per tier as melee weapons,
-- but slightly less attack for the added range — a straight upgrade would
-- make melee pointless.
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('lc_ranged_basic', 'land_clearing', 'ranged', 'Salvaged Sidearm (Ranged)', 'Basic attack power, extended reach.',            40,    '{"attack": 1, "range": 2}', true, 0.5),
  ('lc_ranged_t2',    'land_clearing', 'ranged', 'Autocannon (Ranged)',      'More attack power, further reach.',             400,   '{"attack": 2, "range": 3}', true, 0.5),
  ('lc_ranged_t3',    'land_clearing', 'ranged', 'Breach Cannon (Ranged)',   'Significant attack power, long reach.',         2200,  '{"attack": 4, "range": 4}', true, 0.5),
  ('lc_ranged_t4',    'land_clearing', 'ranged', 'Siege Driver (Ranged)',    'Heavy attack power, very long reach.',          9000,  '{"attack": 6, "range": 5}', true, 0.5);
