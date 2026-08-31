-- Real art for the seven basic chassis items, served from public/images/.
-- Filenames use American spelling (basic_analyzer.png, basic_armor.png);
-- item_keys keep the catalog's British spelling (analyser_basic,
-- armour_basic) — just a filename mismatch, not a data inconsistency.
update item_catalog set image_url = '/images/basic_fuel.png'     where item_key = 'fuel_basic';
update item_catalog set image_url = '/images/basic_cargo.png'    where item_key = 'cargo_basic';
update item_catalog set image_url = '/images/basic_armor.png'    where item_key = 'armour_basic';
update item_catalog set image_url = '/images/basic_drive.png'    where item_key = 'drive_basic';
update item_catalog set image_url = '/images/basic_steering.png' where item_key = 'steer_basic';
update item_catalog set image_url = '/images/basic_sensor.png'   where item_key = 'sensor_basic';
update item_catalog set image_url = '/images/basic_analyzer.png' where item_key = 'analyser_basic';
