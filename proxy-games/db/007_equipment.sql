-- Single-use field tools: a separate slot pool from chassis gear (see
-- getEquipmentSlotTotal() in lib/mining-inventory.ts). 'equipment_slot' is
-- the one-time unlock (not equippable, like 'expansion'); 'equipment' is
-- the pair of consumables that actually go in the slot it unlocks.
insert into item_catalog (item_key, game, category, label, description, cost, effects) values
  ('equipment_slot_unlock', 'mining', 'equipment_slot', 'Equipment Bay', 'Unlocks one slot for single-use field tools. One-time purchase.', 25000, '{}'),
  ('ore_siphon', 'mining', 'equipment', 'Ore Siphon', 'Burns carried ore for fuel — trades tonnage for range. Consumed on use.', 300, '{}'),
  ('line_scanner', 'mining', 'equipment', 'Line Scanner', 'Narrow-beam scan down one row or column, full map length. Reveals everything until it hits an uncuttable seam. Consumed on use.', 500, '{}');
