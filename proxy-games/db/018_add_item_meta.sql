-- Generic per-item metadata, keyed by domain — starts with 'mining' (the
-- ore taxonomy currently hardcoded as ORE_TYPES in lib/mining-engine.ts),
-- but deliberately not named mining_meta: weapons, crafting, and whatever
-- else this shell grows will want their own domain-specific data on
-- item_catalog rows without a new column each time. Same pattern effects
-- already uses (a generic jsonb blob, interpreted by category) — see the
-- header comment on item_catalog in db/004_item_catalog.sql.
--
-- Null on every row until a domain actually needs it. For 'mining', the
-- shape is { mining: { tier, grade_values, value_multiplier, depth_gate,
-- adds_map_size } } — one row per mineral, values copied verbatim from the
-- current ORE_TYPES table so this is a data-only migration, not a balance
-- change. lib/mining-engine.ts is still the source of truth until the
-- engine is switched over to read this column instead (see the
-- ORE_TYPES-consolidation discussion) — until then, this column is inert.
alter table item_catalog add column item_meta jsonb;

update item_catalog set item_meta = '{"mining": {"tier": 1, "grade_values": [0, 1, 3, 8, 20], "value_multiplier": 1, "depth_gate": 0, "adds_map_size": 0}}'::jsonb where item_key = 'copper';
update item_catalog set item_meta = '{"mining": {"tier": 1, "grade_values": [0, 1, 2, 8, 20], "value_multiplier": 1.5, "depth_gate": 0, "adds_map_size": 2}}'::jsonb where item_key = 'zinc';
update item_catalog set item_meta = '{"mining": {"tier": 1, "grade_values": [0, 1, 2, 8, 20], "value_multiplier": 2, "depth_gate": 0, "adds_map_size": 2}}'::jsonb where item_key = 'iron';
update item_catalog set item_meta = '{"mining": {"tier": 2, "grade_values": [0, 1, 2, 6, 18], "value_multiplier": 5, "depth_gate": 0.35, "adds_map_size": 2}}'::jsonb where item_key = 'silver';
update item_catalog set item_meta = '{"mining": {"tier": 2, "grade_values": [0, 1, 2, 6, 18], "value_multiplier": 8, "depth_gate": 0.35, "adds_map_size": 2}}'::jsonb where item_key = 'gold';
update item_catalog set item_meta = '{"mining": {"tier": 2, "grade_values": [0, 1, 2, 6, 18], "value_multiplier": 12, "depth_gate": 0.35, "adds_map_size": 2}}'::jsonb where item_key = 'platinum';
update item_catalog set item_meta = '{"mining": {"tier": 3, "grade_values": [0, 1, 2, 5, 15], "value_multiplier": 20, "depth_gate": 0.55, "adds_map_size": 2}}'::jsonb where item_key = 'silica';
update item_catalog set item_meta = '{"mining": {"tier": 3, "grade_values": [0, 1, 2, 5, 15], "value_multiplier": 28, "depth_gate": 0.55, "adds_map_size": 2}}'::jsonb where item_key = 'germanium';
update item_catalog set item_meta = '{"mining": {"tier": 3, "grade_values": [0, 1, 2, 5, 15], "value_multiplier": 35, "depth_gate": 0.55, "adds_map_size": 2}}'::jsonb where item_key = 'cadmium';
update item_catalog set item_meta = '{"mining": {"tier": 4, "grade_values": [0, 1, 2, 4, 8], "value_multiplier": 60, "depth_gate": 0.72, "adds_map_size": 0}}'::jsonb where item_key = 'neodymium';
update item_catalog set item_meta = '{"mining": {"tier": 4, "grade_values": [0, 1, 2, 4, 8], "value_multiplier": 80, "depth_gate": 0.72, "adds_map_size": 0}}'::jsonb where item_key = 'yttrium';
update item_catalog set item_meta = '{"mining": {"tier": 4, "grade_values": [0, 1, 2, 4, 8], "value_multiplier": 100, "depth_gate": 0.72, "adds_map_size": 0}}'::jsonb where item_key = 'lanthanum';
update item_catalog set item_meta = '{"mining": {"tier": 4, "grade_values": [0, 1, 2, 4, 8], "value_multiplier": 130, "depth_gate": 0.72, "adds_map_size": 0}}'::jsonb where item_key = 'tantalum';
