-- Three new equippable part categories (heater/radiator/valve) plus a
-- one-time Auto-Decanter unlock — the direct equipment answer to the
-- tier-2+ sustainability problem: heat has to ride near its ceiling to
-- feed pressure into its own band, with previously no cheap way back down
-- (a fixed 5u/sec heater floor, an ambient dissipation rate no upgrade
-- touched, and a flat 45-point vent bleed too blunt to hold a narrow
-- band). See lib/refine-engine.ts's RefineRig/rigFromEffects comments for
-- the mechanics; this is purely the catalog data.
--
-- Renaming the existing cooler_* rows: "cooling fins" now means the
-- radiator (sink -> ambient) per the discussion that produced this
-- migration; the part that was called fins (vat -> sink transfer,
-- rig.sinkRate) is relabeled "cooling coils" so the two jobs read as two
-- distinct components instead of one overloaded name. No item_key or
-- category change — only display label/description, so no player_inventory
-- rows are affected.
update item_catalog set
  label = 'Basic Cooling Coils',
  description = 'Pulls heat from the vat into the sink while actively dumped.'
  where item_key = 'cooler_basic';
update item_catalog set
  label = 'Cooling Coils II',
  description = 'Pulls heat from the vat faster while dumping.'
  where item_key = 'cooler_t2';
update item_catalog set
  label = 'Cooling Coils III',
  description = 'Pulls heat from the vat significantly faster.'
  where item_key = 'cooler_t3';

-- Heater: sets the *floor* the vat-heater dial (§4.11-style, always-on
-- standing burn) can be tuned down to, not just its ceiling. The old
-- fixed 5u/sec floor meant a player could never run the heater lower —
-- heater_t2 opens that down to 1.
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('heater_basic', 'refine', 'heater', 'Basic Heater',     'Standing vat heat source. Tunable 5-25u/sec.', 1,    '{"heaterMin": 5, "heaterMax": 25}', true, 0.5),
  ('heater_t2',    'refine', 'heater', 'Precision Heater', 'A much lower floor — tunable 1-25u/sec.',      3500, '{"heaterMin": 1, "heaterMax": 25}', true, 0.5);

-- Radiator: sink -> ambient dissipation rate. Previously a flat constant
-- (2/sec) with no upgrade path at all — a maxed cooling-coils part could
-- fill the sink four times faster without the sink itself ever draining
-- any faster in return. This is the actual fix for that gap.
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('radiator_basic', 'refine', 'radiator', 'Basic Radiator Fins', 'Sheds the sink''s stored heat to the outside world.', 1,    '{"dissipationRate": 2}', true, 0.5),
  ('radiator_t2',    'refine', 'radiator', 'Radiator Fins II',    'Sheds ambient heat faster.',                          4000, '{"dissipationRate": 4}', true, 0.5),
  ('radiator_t3',    'refine', 'radiator', 'Radiator Fins III',   'Sheds ambient heat significantly faster.',            12000,'{"dissipationRate": 8}', true, 0.5);

-- Valve: the tunable range a vent click releases (state.ventAmount),
-- replacing the flat 45-point bleed. Basic already gives real room to
-- trim down without losing the old full-strength top end; the precision
-- tier reaches a 1-point bleed for holding tier-4's +-3 pressure band.
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('valve_basic', 'refine', 'valve', 'Basic Vent Valve',     'Tune how much pressure one vent releases: 10-45.', 1,    '{"ventMin": 10, "ventMax": 45}', true, 0.5),
  ('valve_t2',    'refine', 'valve', 'Precision Vent Valve', 'A 1-point bleed for holding a narrow band.',       3000, '{"ventMin": 1, "ventMax": 45}',  true, 0.5);

-- Auto-Decanter: a one-time, non-stat unlock (not a PART_CATEGORY item —
-- there's nothing to pick between) that reveals a second "Decant All"
-- button alongside the existing single-unit Decant. Same one-time-gate
-- shape as mining's equipment_slot_unlock (db/007_equipment.sql): owning 1
-- means unlocked, never sellable back (a sold unlock would be
-- indistinguishable from never having bought it).
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('decanter_auto', 'refine', 'decanter_unlock', 'Auto-Decanter', 'Unlocks Decant All — bank everything currently affordable in one click.', 3000, '{}', false, null);

-- Backfill for players who already have a refine starter kit (identified
-- by owning furnace_basic) — grants the three new basic parts, equipped,
-- so an existing player's Rig page shows them active immediately instead
-- of "you don't own one yet" for something that already worked via
-- rigFromEffects()'s fallback. New signups get these through
-- REFINE_STARTER_KIT in lib/refine-inventory.ts instead.
insert into player_inventory (player_id, item_key, owned_quantity, equipped_quantity)
select player_id, 'heater_basic', 1, 1 from player_inventory where item_key = 'furnace_basic'
on conflict (player_id, item_key) do nothing;
insert into player_inventory (player_id, item_key, owned_quantity, equipped_quantity)
select player_id, 'radiator_basic', 1, 1 from player_inventory where item_key = 'furnace_basic'
on conflict (player_id, item_key) do nothing;
insert into player_inventory (player_id, item_key, owned_quantity, equipped_quantity)
select player_id, 'valve_basic', 1, 1 from player_inventory where item_key = 'furnace_basic'
on conflict (player_id, item_key) do nothing;
