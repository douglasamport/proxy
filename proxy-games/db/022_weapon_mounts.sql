-- Weapon mounts: a separate slot pool from the general chassis gear pool
-- (slot_count), same split mining already has between chassis slots and
-- its single equipment-bay slot (see EQUIPMENT_CATEGORY in
-- lib/mining-inventory.ts) — except this one is meant to grow past 1, the
-- same doubling-price mechanic as slot_count itself (see
-- purchaseWeaponMountExpansion() in lib/proxy-store.ts).
--
-- Every weapon/ranged/aoe item in land-clearing's catalog now draws from
-- this pool instead of the general one — a chassis carries N weapons
-- (N = weapon_mounts) *in addition to* its ordinary armor/drive/etc gear,
-- not instead of some of it.
alter table proxies add column weapon_mounts int not null default 1;

-- One-time-per-purchase (doubling price) unlock item for land-clearing,
-- same category convention as db/006_chassis_expansion.sql's 'expansion' —
-- see EXPANSION_CATEGORY in lib/proxy-store.ts for why this is looked up
-- by category, not a literal shared item_key.
insert into item_catalog (item_key, game, category, label, description, cost, effects, sellable, sell_value) values
  ('weapon_mount_expansion', 'land_clearing', 'weapon_mount', 'Weapon Mount', 'Permanently adds one weapon mount to this chassis. Price doubles with each one you own.', 3000, '{}', false, null);

-- Backfill: any land-clearing proxy that already has more weapon-like items
-- equipped than the new default of 1 keeps room for all of them — nobody's
-- existing loadout becomes retroactively over-cap.
update proxies p
set weapon_mounts = greatest(1, coalesce((
  select sum(pl.equipped_quantity)::int
  from proxy_loadout pl
  join item_catalog ic on ic.item_key = pl.item_key
  where pl.proxy_id = p.id and ic.category in ('weapon', 'ranged', 'aoe')
), 0))
where exists (
  select 1 from proxy_loadout pl
  join item_catalog ic on ic.item_key = pl.item_key
  where pl.proxy_id = p.id and ic.category in ('weapon', 'ranged', 'aoe')
);
