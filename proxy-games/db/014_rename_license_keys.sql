-- Rename the licence category/keys to American spelling, leading with
-- "license" instead of trailing it (zinc_licence -> license_zinc), per
-- follow-up direction after Stage 5 shipped. Safe as a plain PK rename:
-- checked first that no player_inventory row references category
-- 'licence' yet (0 rows), so there's no FK ordering concern.
update item_catalog set item_key = 'license_zinc',      category = 'license' where item_key = 'zinc_licence';
update item_catalog set item_key = 'license_iron',      category = 'license' where item_key = 'iron_licence';
update item_catalog set item_key = 'license_silver',    category = 'license' where item_key = 'silver_licence';
update item_catalog set item_key = 'license_gold',      category = 'license' where item_key = 'gold_licence';
update item_catalog set item_key = 'license_platinum',  category = 'license' where item_key = 'platinum_licence';
update item_catalog set item_key = 'license_silica',    category = 'license' where item_key = 'silica_licence';
update item_catalog set item_key = 'license_germanium', category = 'license' where item_key = 'germanium_licence';
update item_catalog set item_key = 'license_cadmium',   category = 'license' where item_key = 'cadmium_licence';
update item_catalog set item_key = 'license_neodymium', category = 'license' where item_key = 'neodymium_licence';
update item_catalog set item_key = 'license_yttrium',   category = 'license' where item_key = 'yttrium_licence';
update item_catalog set item_key = 'license_lanthanum', category = 'license' where item_key = 'lanthanum_licence';
update item_catalog set item_key = 'license_tantalum',  category = 'license' where item_key = 'tantalum_licence';
