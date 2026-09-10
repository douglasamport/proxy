-- Area-of-effect weapons — a third weapon category alongside 'weapon'
-- (melee, single-target) and 'ranged' (single-target, extended reach).
-- `aoeRadius` is what marks a weapon as AoE at all (0/absent = ordinary
-- single-target) — see Weapon/RawWeapon and fight() in
-- lib/land-clearing-engine.ts. `range` here is how far from the Proxy the
-- blast's center tile can be picked; `attack` is per-entity damage dealt to
-- everything caught inside `aoeRadius` of that tile, not a total split
-- across targets. Priced above the equivalent single-target tier — hitting
-- a cluster is strictly more valuable than hitting one target.
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('lc_aoe_basic', 'land_clearing', 'aoe', 'Salvaged Lobber',  'Light blast damage in a small radius.',        70,    '{"attack": 1, "range": 2, "aoeRadius": 1}', true, 0.5),
  ('lc_aoe_t2',    'land_clearing', 'aoe', 'Frag Launcher',    'More blast damage, still a small radius.',     600,   '{"attack": 2, "range": 3, "aoeRadius": 1}', true, 0.5),
  ('lc_aoe_t3',    'land_clearing', 'aoe', 'Cluster Launcher', 'Significant blast damage, a wider radius.',    3200,  '{"attack": 3, "range": 3, "aoeRadius": 2}', true, 0.5),
  ('lc_aoe_t4',    'land_clearing', 'aoe', 'Siege Mortar',     'Heavy blast damage across a wide radius.',     12000, '{"attack": 4, "range": 4, "aoeRadius": 2}', true, 0.5);
