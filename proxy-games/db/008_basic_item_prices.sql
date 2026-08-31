-- Real starter pricing, replacing the $1 testing placeholders. Priced by
-- gameplay impact, not uniform — drive/steer are worth the most since dig
-- and turn cost are both 1/stat, so each unit is a compounding efficiency
-- gain, not a flat one. See the pricing discussion in conversation history
-- for the per-item reasoning.
update item_catalog set cost = 1200 where item_key = 'drive_basic';
update item_catalog set cost = 1000 where item_key = 'steer_basic';
update item_catalog set cost = 900  where item_key = 'sensor_basic';
update item_catalog set cost = 700  where item_key = 'armour_basic';
update item_catalog set cost = 600  where item_key = 'fuel_basic';
update item_catalog set cost = 500  where item_key = 'cargo_basic';
update item_catalog set cost = 400  where item_key = 'analyser_basic';
