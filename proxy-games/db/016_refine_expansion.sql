-- Refinery expansion: tier-2/3 rig parts, refined-output rows for every
-- mineral (mining already supports all 13 via licences — see
-- loadUnlockedOreTypes() in lib/mining-inventory.ts, which this migration
-- makes actually usable end-to-end for refining), and one consumable.
--
-- Rig parts need no new engine/UI code at all: the Rig page
-- (app/games/refine/rig/page.tsx) already lists every owned item in a
-- category and lets the player activate any one of them — adding a better
-- furnace/vat/cooler tier is purely a data change. Effects use the same
-- stat keys as the tier-1 rows (db/015_refine_catalog.sql).
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('furnace_t2', 'refine', 'furnace', 'Furnace II', 'Faster melt — more heat processed per minute.', 4000,  '{"meltSpeedMult": 1.8}', true, 0.5),
  ('furnace_t3', 'refine', 'furnace', 'Furnace III', 'Significantly faster melt.',                    12000, '{"meltSpeedMult": 3.0}', true, 0.5),
  ('vat_t2',     'refine', 'vat',     'Vat II',     'Larger tank — more headroom before overflow.',    4000,  '{"tankCapacity": 200}', true, 0.5),
  ('vat_t3',     'refine', 'vat',     'Vat III',    'Significantly larger tank.',                      12000, '{"tankCapacity": 400}', true, 0.5),
  ('cooler_t2',  'refine', 'cooler',  'Cooling Fins II',  'Sheds heat faster while dumping.',           4000,  '{"sinkRate": 16}', true, 0.5),
  ('cooler_t3',  'refine', 'cooler',  'Cooling Fins III', 'Significantly faster heat rejection.',       12000, '{"sinkRate": 32}', true, 0.5);

-- Refined output per mineral — same shape as db/015's copper_cathode
-- (cost 0, no buy side; sellable at a flat price via FLAT_SELL_PRICE_CATEGORIES
-- in lib/mining-inventory.ts). Real-world refined forms, not a uniform
-- "ingot" label: rare earths are commercially oxides/powder, not metal
-- ingots — see the design doc's naming table. sell_value scales off
-- copper_cathode's 85 by the same value_multiplier mining's ore prices use
-- (db/011_sell_prices.sql), so the two economies stay on one consistent
-- scale.
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('zinc_ingot',        'refine', 'refined', 'Zinc Ingot',        'Refined zinc, cast.',                       0, '{}', true, 127.5),
  ('iron_ingot',        'refine', 'refined', 'Iron Ingot',        'Refined iron, cast.',                       0, '{}', true, 170),
  ('silver_bar',        'refine', 'refined', 'Silver Bar',        'Refined silver, bullion-grade.',            0, '{}', true, 425),
  ('gold_bar',          'refine', 'refined', 'Gold Bar',          'Refined gold, bullion-grade.',              0, '{}', true, 680),
  ('platinum_ingot',    'refine', 'refined', 'Platinum Ingot',    'Refined platinum, cast from sponge.',       0, '{}', true, 1020),
  ('refined_silicon',   'refine', 'refined', 'Refined Silicon',   'Elemental silicon, metallurgical grade.',   0, '{}', true, 1700),
  ('germanium_ingot',   'refine', 'refined', 'Germanium Ingot',   'Refined germanium, semiconductor feedstock.', 0, '{}', true, 2380),
  ('cadmium_ingot',     'refine', 'refined', 'Cadmium Ingot',     'Refined cadmium, cast.',                    0, '{}', true, 2975),
  ('neodymium_oxide',   'refine', 'refined', 'Neodymium Oxide',   'Refined neodymium — the commercial rare-earth form.', 0, '{}', true, 5100),
  ('yttrium_oxide',     'refine', 'refined', 'Yttrium Oxide',     'Refined yttrium — the commercial rare-earth form.',   0, '{}', true, 6800),
  ('lanthanum_oxide',   'refine', 'refined', 'Lanthanum Oxide',   'Refined lanthanum — the commercial rare-earth form.', 0, '{}', true, 8500),
  ('tantalum_powder',   'refine', 'refined', 'Tantalum Powder',   'Refined tantalum, capacitor-grade powder.', 0, '{}', true, 11050);

-- One-time-use consumable: instantly empties the cooler's stored heat back
-- to 0, giving full headroom back on demand rather than waiting on
-- dumping+fins. Deliberately NOT wired through mining's equip-slot system
-- (setEquipped/EQUIPMENT_CATEGORY, sized by equipment_slot_unlock) — that
-- machinery exists to arbitrate a shared slot pool across many
-- simultaneously-equipped items, which this doesn't need. It's just
-- consumed straight from owned_quantity on use (see applyUseCoolant() in
-- lib/refine-engine.ts and the /api/refine/[id]/coolant route) — own one,
-- use it once, buy another.
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('coolant_flush', 'refine', 'consumable', 'Coolant Flush', 'Instantly empties the cooler. One-time use.', 1500, '{}', true, 0.5);
