-- item_catalog.game becomes item_class: what an item is *for* ('mining',
-- 'refine', later something more specific), independent of any site —
-- a site (or several instances of one, e.g. private mines) just asks for
-- the classes it sells. Values are unchanged, so existing rows keep
-- 'mining'/'refine'. item_catalog.site_id is left in place for now
-- (refine-inventory.ts still reads it); drop it in the final cleanup.
alter table item_catalog rename column game to item_class;
