-- Stage 5 of build-spec-ore-progression.md: the mechanism for unlocking new
-- ore. One-time, per-mineral licences — a one-time gate, same shape as
-- equipment_slot_unlock (see lib/mining-inventory.ts): owning 1 means
-- unlocked, there's nothing to equip, no quantity beyond that matters.
--
-- Copper isn't here: it's unlocked from the start (see the taxonomy's map-
-- scaling table in Stage 1), never gated by a licence at all — so there
-- are 12 rows, not 13. Item keys are '<ore>_licence' since the bare ore
-- keys are already taken by the sellable ore rows from migration 010.
--
-- Price scales with the ore's own value_multiplier from the Stage 1
-- taxonomy (2500 x multiplier) — expensive ore, expensive licence, tier 4
-- a genuine long grind. Not sellable: selling a licence back would have to
-- un-happen map size and field generation that already used it.
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('zinc_licence',      'mining', 'licence', 'Zinc Licence',      'Unlocks zinc for field generation. Adds to map size.',           3750,   '{}', false, null),
  ('iron_licence',      'mining', 'licence', 'Iron Licence',      'Unlocks iron for field generation. Adds to map size.',           5000,   '{}', false, null),
  ('silver_licence',    'mining', 'licence', 'Silver Licence',    'Unlocks silver for field generation. Adds to map size.',         12500,  '{}', false, null),
  ('gold_licence',      'mining', 'licence', 'Gold Licence',      'Unlocks gold for field generation. Adds to map size.',           20000,  '{}', false, null),
  ('platinum_licence',  'mining', 'licence', 'Platinum Licence',  'Unlocks platinum for field generation. Adds to map size.',       30000,  '{}', false, null),
  ('silica_licence',    'mining', 'licence', 'Silica Licence',    'Unlocks silica for field generation. Adds to map size.',         50000,  '{}', false, null),
  ('germanium_licence', 'mining', 'licence', 'Germanium Licence', 'Unlocks germanium for field generation. Adds to map size.',      70000,  '{}', false, null),
  ('cadmium_licence',   'mining', 'licence', 'Cadmium Licence',   'Unlocks cadmium for field generation. Adds to map size.',        87500,  '{}', false, null),
  ('neodymium_licence', 'mining', 'licence', 'Neodymium Licence', 'Unlocks neodymium. Rare earth — finding it at all is the win.', 150000,  '{}', false, null),
  ('yttrium_licence',   'mining', 'licence', 'Yttrium Licence',   'Unlocks yttrium. Rare earth — finding it at all is the win.',   200000,  '{}', false, null),
  ('lanthanum_licence', 'mining', 'licence', 'Lanthanum Licence', 'Unlocks lanthanum. Rare earth — finding it at all is the win.', 250000,  '{}', false, null),
  ('tantalum_licence',  'mining', 'licence', 'Tantalum Licence',  'Unlocks tantalum. Rare earth — finding it at all is the win.',  325000,  '{}', false, null);
