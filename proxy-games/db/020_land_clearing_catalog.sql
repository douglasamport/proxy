-- Land-clearing's own item catalog — a separate 16-slot chassis rig from
-- mining (see lib/land-clearing-engine.ts's StatKey/Chassis and
-- lib/proxy-store.ts for why this is safe to equip onto a totally
-- different Proxy without touching mining's slots at all).
--
-- Six equippable categories, tiers 1-4 (basic/t2/t3/t4, same naming
-- convention as mining's fuel_basic/fuel_t2/fuel_t3). Tiers exist for two
-- reasons at once: they're the store's progression ladder, AND they're
-- exactly the pool land-clearing's quick-salvage loot rolls draw from (see
-- rollLoot() in lib/land-clearing-engine.ts) — a wreck can drop a spare
-- copy of any of these, weighted toward tier 1.
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('lc_weapon_basic', 'land_clearing', 'weapon', 'Salvaged Sidearm',   'Basic attack power.',                 40,    '{"attack": 2}',        true, 0.5),
  ('lc_weapon_t2',    'land_clearing', 'weapon', 'Autocannon',        'More attack power.',                  400,   '{"attack": 4}',        true, 0.5),
  ('lc_weapon_t3',    'land_clearing', 'weapon', 'Breach Cannon',     'Significant attack power.',            2200,  '{"attack": 7}',        true, 0.5),
  ('lc_weapon_t4',    'land_clearing', 'weapon', 'Siege Driver',      'Heavy attack power.',                  9000,  '{"attack": 11}',       true, 0.5),

  ('lc_armor_basic',  'land_clearing', 'armor',  'Scrap Plating',     'Basic damage reduction.',              40,    '{"armor": 1}',         true, 0.5),
  ('lc_armor_t2',     'land_clearing', 'armor',  'Composite Plating', 'More damage reduction.',                400,   '{"armor": 2}',         true, 0.5),
  ('lc_armor_t3',     'land_clearing', 'armor',  'Reactive Plating',  'Significant damage reduction.',        2200,  '{"armor": 4}',         true, 0.5),
  ('lc_armor_t4',     'land_clearing', 'armor',  'Bulwark Plating',   'Heavy damage reduction.',               9000,  '{"armor": 7}',         true, 0.5),

  ('lc_drive_basic',  'land_clearing', 'drive',  'Salvaged Actuator', 'Cheaper movement, energy-wise.',       40,    '{"speed": 0.15}',      true, 0.5),
  ('lc_drive_t2',     'land_clearing', 'drive',  'Servo Actuator',    'Cheaper movement.',                    400,   '{"speed": 0.28}',      true, 0.5),
  ('lc_drive_t3',     'land_clearing', 'drive',  'Torque Actuator',   'Significantly cheaper movement.',      2200,  '{"speed": 0.40}',      true, 0.5),
  ('lc_drive_t4',     'land_clearing', 'drive',  'Overdrive Actuator','Very cheap movement.',                 9000,  '{"speed": 0.55}',      true, 0.5),

  ('lc_steer_basic',  'land_clearing', 'steer',  'Salvaged Linkage',  'A few more tiles per move action.',    40,    '{"movement": 0.3}',    true, 0.5),
  ('lc_steer_t2',     'land_clearing', 'steer',  'Servo Linkage',     'More tiles per move action.',          400,   '{"movement": 0.6}',    true, 0.5),
  ('lc_steer_t3',     'land_clearing', 'steer',  'Precision Linkage', 'Significantly more tiles per action.', 2200,  '{"movement": 1.0}',    true, 0.5),
  ('lc_steer_t4',     'land_clearing', 'steer',  'Stride Linkage',    'Many more tiles per move action.',     9000,  '{"movement": 1.5}',    true, 0.5),

  ('lc_sensor_basic', 'land_clearing', 'sensor', 'Salvaged Optics',   'A wider fog-of-war reveal radius.',    40,    '{"vision": 1}',        true, 0.5),
  ('lc_sensor_t2',    'land_clearing', 'sensor', 'Array Optics',      'A wider reveal radius.',                400,   '{"vision": 2}',        true, 0.5),
  ('lc_sensor_t3',    'land_clearing', 'sensor', 'Long Optics',       'A significantly wider reveal radius.', 2200,  '{"vision": 3}',        true, 0.5),
  ('lc_sensor_t4',    'land_clearing', 'sensor', 'Horizon Optics',    'A very wide reveal radius.',            9000,  '{"vision": 4}',        true, 0.5),

  ('lc_salvage_basic','land_clearing', 'salvage','Salvage Rig I',     'Better odds of a part drop on a kill.', 40,    '{"salvageYield": 0.05}', true, 0.5),
  ('lc_salvage_t2',   'land_clearing', 'salvage','Salvage Rig II',    'Even better part-drop odds.',           400,   '{"salvageYield": 0.10}', true, 0.5),
  ('lc_salvage_t3',   'land_clearing', 'salvage','Salvage Rig III',   'Significantly better part-drop odds.',  2200,  '{"salvageYield": 0.18}', true, 0.5),
  ('lc_salvage_t4',   'land_clearing', 'salvage','Salvage Rig IV',    'Very high part-drop odds.',             9000,  '{"salvageYield": 0.28}', true, 0.5),

  -- Not equippable, unlimited quantity — same non-equip shape as ore in the
  -- mining catalog. Always dropped by a kill (see rollLoot()); flat sell
  -- price rather than a ratio of `cost`, since cost is 0 (there's no buy
  -- side — see lib/land-clearing-inventory.ts's FLAT_SELL_PRICE_CATEGORIES).
  ('lc_scrap', 'land_clearing', 'scrap', 'Scrap', 'Salvaged wreckage — sellable, not equippable.', 0, '{}', true, 2),

  -- Chassis capacity, same doubling-price mechanic as mining's — see
  -- purchaseChassisExpansion() in lib/proxy-store.ts (already game-generic).
  ('chassis_expansion_lc', 'land_clearing', 'expansion', 'Chassis Slot', 'Permanently adds one slot to this chassis. Price doubles with each one you own.', 2000, '{}', false, null);
