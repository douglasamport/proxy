-- The 13 ore rows from the taxonomy in build-spec-ore-progression.md, as
-- `item_catalog` entries of a new 'ore' category — same generic table
-- fuel/cargo/armour items already live in (see lib/mining-inventory.ts).
-- cost is 0: there's no buy side yet (that's Stage 5's survey store), ore
-- only ever enters player_inventory by mining it and choosing to stockpile
-- (Stage 2). Only copper is actually mineable right now (see ORE_TYPES in
-- lib/mining-engine.ts) — the other 12 rows exist so the inventory grid and
-- future stages don't need another migration to add them.
insert into item_catalog (item_key, game, category, label, description, cost, effects) values
  ('copper',     'mining', 'ore', 'Copper',     'Common ore. Abundant, wide grade spread.', 0, '{}'),
  ('zinc',       'mining', 'ore', 'Zinc',       'Common ore. Abundant, wide grade spread.', 0, '{}'),
  ('iron',       'mining', 'ore', 'Iron',       'Common ore. Abundant, wide grade spread.', 0, '{}'),
  ('silver',     'mining', 'ore', 'Silver',     'Precious ore. Found past the shallows.',   0, '{}'),
  ('gold',       'mining', 'ore', 'Gold',       'Precious ore. Found past the shallows.',   0, '{}'),
  ('platinum',   'mining', 'ore', 'Platinum',   'Precious ore. Found past the shallows.',   0, '{}'),
  ('silica',     'mining', 'ore', 'Silica',     'Semiconductor ore. A genuine depth run.',  0, '{}'),
  ('germanium',  'mining', 'ore', 'Germanium',  'Semiconductor ore. A genuine depth run.',  0, '{}'),
  ('cadmium',    'mining', 'ore', 'Cadmium',    'Semiconductor ore. A genuine depth run.',  0, '{}'),
  ('neodymium',  'mining', 'ore', 'Neodymium',  'Rare earth. Finding it at all is the win.', 0, '{}'),
  ('yttrium',    'mining', 'ore', 'Yttrium',    'Rare earth. Finding it at all is the win.', 0, '{}'),
  ('lanthanum',  'mining', 'ore', 'Lanthanum',  'Rare earth. Finding it at all is the win.', 0, '{}'),
  ('tantalum',   'mining', 'ore', 'Tantalum',   'Rare earth. Finding it at all is the win.', 0, '{}');
