-- Chassis expansion: a permanent +1 slot capacity item, not equippable like
-- everything else (see lib/mining-inventory.ts). `cost` here is the BASE
-- price — the first one. Each additional one a player buys costs double the
-- last (computed in purchaseChassisExpansion(), not stored per-purchase),
-- so this single row's cost is the only number to tune the whole curve.
insert into item_catalog (item_key, game, category, label, description, cost, effects) values
  ('chassis_expansion', 'mining', 'expansion', 'Chassis Slot', 'Permanently adds one slot to your chassis capacity. Price doubles with each one you own.', 2000, '{}');
