-- Item art. Nullable — most rows won't have real art yet, callers fall back
-- to a placeholder (see lib/mining-inventory.ts / the store & build screens).
alter table item_catalog add column image_url text;
