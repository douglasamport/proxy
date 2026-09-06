-- Refinery v1 (minigame-v2-the-refinery.md), first migration: the equipment
-- catalog for the refine game plus its one refined-output good. Same
-- generic item_catalog/player_inventory tables mining already uses — game
-- scoping is just the `game` column, nothing new needed there. Ore itself
-- gets no new row here: refine reads the existing game='mining' `copper`
-- item directly out of player_inventory, since that table was never scoped
-- by game in the first place (only item_catalog is). A block mined in the
-- mining game and a block melted in the refinery are the same row.
--
-- Three equippable categories, one per pipeline stage from the design doc
-- (Melt / Vat / Cool), effects shaped exactly like chassis gear — a
-- stat-name -> delta map, summed the same way computeEffects() sums
-- mining's. The stat keys below (meltSpeedMult, tankCapacity, sinkRate)
-- are placeholders for lib/refine-engine.ts's StatKey type, to be built
-- next — same order mining originally followed (item_catalog effects keys
-- were decided, then lib/mining-engine.ts's StatKey enumerated them).
--
-- meltSpeedMult follows the sensorBlur/speed convention: additive delta
-- around a working baseline, used as a multiplier downstream (actual melt
-- time = base table time from doc §4.1 / meltSpeedMult). A totally
-- unequipped chassis has meltSpeedMult 0 and therefore cannot melt at all —
-- same divide-by-zero-avoidance reason mining's BASELINE_DRIVE/STEER exist —
-- which is exactly why furnace_basic must ship as part of the starter kit,
-- not left for the player to discover they need.
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('furnace_basic', 'refine', 'furnace', 'Basic Furnace',      'Melts fed ore into the vat.',                    1, '{"meltSpeedMult": 1.0}', true, 0.5),
  ('vat_basic',     'refine', 'vat',     'Basic Vat',          'Holds molten ore and slag. Sets tank capacity.', 1, '{"tankCapacity": 100}',  true, 0.5),
  ('cooler_basic',  'refine', 'cooler',  'Basic Cooling Fins', 'Sheds heat to the sink while actively dumped.',  1, '{"sinkRate": 8}',        true, 0.5);

-- Copper Cathode: the one refined output for the copper-only MVP (see
-- section 5 of the naming table — electrolytic cathode is the real-world
-- refined form of copper, 99.99% purity). cost 0: same "no buy side yet"
-- state ore started in (db/010) — a cathode is only ever produced by
-- decanting, never purchased from the system. sell_value 85 is a deliberate
-- placeholder above the raw-ore-equivalent ceiling: worst-case decant is 10
-- ore per unit (design doc §4.9), and copper ore itself sells at 6.5/unit
-- (db/011's CFG.ORE_PRICE anchor) — 10 x 6.5 = 65, so even a badly-timed
-- decant nets more than selling the raw ore would have, and a well-timed
-- one (5 ore/unit, 32.5 ore-equivalent) nets far more. Skill in refining is
-- what captures that spread; tune this number directly once real batches
-- are logged.
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('copper_cathode', 'refine', 'refined', 'Copper Cathode', 'Refined copper, 99.99% purity.', 0, '{}', true, 85);
