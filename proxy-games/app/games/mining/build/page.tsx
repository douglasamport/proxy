'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CFG, chassisFromEffects } from '@/lib/mining-engine';
import type { Chassis, StatKey } from '@/lib/mining-engine';
import type { CatalogItem, InventoryRow } from '@/lib/mining-inventory';
import { categoryIcon, FullBuildIcon } from '../icons';
import '../mining.css';

// The dedicated chassis build screen. Separate from the per-run fitting
// flow on purpose: a loadout is now a pile of *owned* items (you might own
// 3 basic fuel cells and 1 boosted one), and equipping mixes and matches
// them — that only works as a master/detail browse, not a 7-row stepper.
// Left: the 7 systems (plus a pinned "Full build" tab that shows
// everything equipped at once, across categories). Middle: your owned
// items for whichever tab is selected, each with an Add/Remove control.
// Right: live chassis stats, recomputed after every equip change. What's
// equipped here is what the next run launches with (see FittingPanel's
// read-only Chassis section on the fitting page).
const FULL_BUILD = '__full__';
const EQUIPMENT_CATEGORY = 'equipment';

function categoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// No real art yet for most items — a placeholder keeps the layout spot
// reserved so dropping in real image_url values later is a data change,
// not a UI one.
function imgSrc(item: CatalogItem): string {
  return item.image_url || `https://placehold.co/72x72/1B222B/54C6DC?text=${encodeURIComponent(item.label.slice(0, 2).toUpperCase())}`;
}

export default function BuildPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [chassis, setChassis] = useState<Chassis>(() => chassisFromEffects({}));
  const [slotTotal, setSlotTotal] = useState(CFG.SLOT_TOTAL);
  const [equipmentSlotTotal, setEquipmentSlotTotal] = useState(0);
  const [authRequired, setAuthRequired] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Chassis comes from the server (baseline + equipped effects, see
  // computeChassis() in lib/mining-inventory.ts) rather than being
  // re-derived here, so the stats panel can't drift from what launch
  // actually uses — every equip/unequip re-fetches it via load().
  const load = useCallback(async () => {
    const res = await fetch('/api/inventory?game=mining');
    if (!res.ok) {
      if (res.status === 401) setAuthRequired(true);
      return;
    }
    setAuthRequired(false);
    const data = await res.json();
    setCatalog(data.catalog);
    setInventory(data.inventory);
    setBalance(data.balance);
    setChassis(data.chassis);
    setSlotTotal(data.slotTotal);
    setEquipmentSlotTotal(data.equipmentSlotTotal);
  }, []);

  const didLoadRef = useRef(false);
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    load();
  }, [load]);

  // 'expansion' and 'equipment_slot' aren't equippable — they're one-time
  // capacity purchases (see the Store), not something to add/remove per
  // run, so neither gets a tab here.
  const categories = useMemo(
    () => Array.from(new Set(catalog.map(c => c.category))).filter(c => c !== 'expansion' && c !== 'equipment_slot'),
    [catalog]
  );

  // Default the selection to the first category once the catalog loads —
  // not a mirrored copy of state, just filling in "nothing picked yet".
  const effectiveCategory = selectedCategory ?? categories[0] ?? null;

  const invByKey = useMemo(() => new Map(inventory.map(r => [r.item_key, r])), [inventory]);
  const catByKey = useMemo(() => new Map(catalog.map(c => [c.item_key, c])), [catalog]);

  // Equipment items (ore siphon, line scanner) draw against their own
  // separate slot pool, not the chassis one — see getEquipmentSlotTotal()
  // in lib/mining-inventory.ts.
  let equippedChassisTotal = 0;
  let equippedEquipmentTotal = 0;
  for (const row of inventory) {
    if (row.equipped_quantity <= 0) continue;
    if (catByKey.get(row.item_key)?.category === EQUIPMENT_CATEGORY) equippedEquipmentTotal += row.equipped_quantity;
    else equippedChassisTotal += row.equipped_quantity;
  }
  const chassisSlotsLeft = slotTotal - equippedChassisTotal;
  const equipmentSlotsLeft = equipmentSlotTotal - equippedEquipmentTotal;

  const equippedByCategory = useMemo(() => {
    const byKey = new Map(catalog.map(c => [c.item_key, c]));
    const totals = new Map<string, number>();
    for (const row of inventory) {
      const item = byKey.get(row.item_key);
      if (!item || row.equipped_quantity <= 0) continue;
      totals.set(item.category, (totals.get(item.category) ?? 0) + row.equipped_quantity);
    }
    return totals;
  }, [catalog, inventory]);

  // Build only ever shows what's actually owned — an item you haven't
  // bought yet isn't something to equip, it's something to go buy (see the
  // Store). Full build narrows further, to what's currently equipped.
  const items = useMemo(() => {
    if (effectiveCategory === FULL_BUILD) {
      return catalog.filter(c => (invByKey.get(c.item_key)?.equipped_quantity ?? 0) > 0);
    }
    return catalog.filter(c => c.category === effectiveCategory && (invByKey.get(c.item_key)?.owned_quantity ?? 0) > 0);
  }, [catalog, effectiveCategory, invByKey]);

  async function setEquipped(itemKey: string, quantity: number) {
    setBusyKey(itemKey);
    setError('');
    const res = await fetch('/api/inventory/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_key: itemKey, quantity }),
    });
    setBusyKey(null);
    if (!res.ok) {
      setError(res.status === 400 ? 'Not enough owned, or that exceeds your slot cap.' : 'Could not update loadout — try again.');
      return;
    }
    await load();
  }

  if (authRequired) {
    return (
      <div className="mining-root">
        <header><div className="brand">Extraction <span>/ build</span></div></header>
        <main className="fit-layout">
          <div className="fit-controls sect">
            <div className="lbl">Sign in required</div>
            <p>Your chassis loadout is tied to your account.</p>
            <a className="go" href="/login" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>Sign in</a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="mining-root">
      <header>
        <div className="brand">Extraction <span>/ build</span></div>
        <div className="seedline">slots {equippedChassisTotal} / {slotTotal}</div>
        <div className="seedline">equipment {equippedEquipmentTotal} / {equipmentSlotTotal}</div>
        <div className="seedline">balance {balance ?? '—'}</div>
        <a className="hbtn" href="/games/mining/store" style={{ textDecoration: 'none' }}>Store</a>
        <a className="hbtn" href="/games/mining" style={{ textDecoration: 'none' }}>Back to run</a>
      </header>

      <main className="build-layout">
        <div className="build-nav">
          <button
            className={`navbtn full ${effectiveCategory === FULL_BUILD ? 'on' : ''}`}
            onClick={() => setSelectedCategory(FULL_BUILD)}
          >
            <span><FullBuildIcon /> Full build</span>
            <b>{equippedChassisTotal + equippedEquipmentTotal}</b>
          </button>
          <div className="build-nav-divider" />
          {categories.map(cat => {
            const Icon = categoryIcon(cat);
            return (
            <button
              key={cat}
              className={`navbtn ${cat === effectiveCategory ? 'on' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              <span><Icon /> {categoryLabel(cat)}</span>
              <b>{equippedByCategory.get(cat) ?? 0}</b>
            </button>
            );
          })}
        </div>

        <div className="build-detail sect">
          {error && <div className="ptip" style={{ color: 'var(--danger)' }}>{error}</div>}
          <div className="lbl">
            {effectiveCategory === FULL_BUILD ? 'Full build' : effectiveCategory ? categoryLabel(effectiveCategory) : ''}
            {' · '}
            {effectiveCategory === FULL_BUILD
              ? `${chassisSlotsLeft} chassis / ${equipmentSlotsLeft} equipment free`
              : (() => {
                  const left = effectiveCategory === EQUIPMENT_CATEGORY ? equipmentSlotsLeft : chassisSlotsLeft;
                  return `${left} slot${left === 1 ? '' : 's'} free`;
                })()}
          </div>

          {items.length === 0 && (
            <p className="ptip">
              {effectiveCategory === FULL_BUILD
                ? 'Nothing equipped yet.'
                : <>You don&rsquo;t own anything in this category yet — visit the <a href="/games/mining/store">store</a>.</>}
            </p>
          )}

          {items.map(item => {
            const owned = invByKey.get(item.item_key)?.owned_quantity ?? 0;
            const equipped = invByKey.get(item.item_key)?.equipped_quantity ?? 0;
            const busy = busyKey === item.item_key;
            const roomLeft = item.category === EQUIPMENT_CATEGORY ? equipmentSlotsLeft : chassisSlotsLeft;
            return (
              <div className="item-group" key={item.item_key}>
                <div className="item-head">
                  {/* eslint-disable-next-line @next/next/no-img-element -- placeholder art until item_catalog.image_url is populated */}
                  <img className="item-thumb" src={imgSrc(item)} alt="" width={72} height={72} />
                  <div>
                    <div className="item-label">{item.label}</div>
                    {item.description && <div className="item-desc">{item.description}</div>}
                    <div className="item-effects">{effectsText(item.effects)}</div>
                  </div>
                </div>

                <div className="unit-row">
                  {Array.from({ length: owned }, (_, i) => {
                    const isEquipped = i < equipped;
                    return (
                      <button
                        key={i}
                        className={`unit-box ${isEquipped ? 'on' : ''}`}
                        disabled={busy || (!isEquipped && roomLeft <= 0)}
                        onClick={() => setEquipped(item.item_key, isEquipped ? equipped - 1 : equipped + 1)}
                        title={isEquipped ? 'Equipped — click to unequip' : 'Click to equip'}
                      >
                        {isEquipped ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
                <div className="item-owned">owned {owned} · equipped {equipped}</div>
              </div>
            );
          })}
        </div>

        <div className="build-stats sect">
          <div className="lbl">Chassis stats</div>
          <div className="derived">
            <div><span>Hold per trip</span><b>{chassis.hold}u</b></div>
            <div><span>Fuel capacity</span><b>{chassis.fuelCap.toFixed(0)}</b></div>
            <div><span>Dig a fresh cell</span><b>{(1 / chassis.speed + CFG.DIG_FUEL).toFixed(2)}</b></div>
            <div><span>Drive a tunnel</span><b>{(1 / chassis.speed * CFG.TUNNEL_MULT).toFixed(2)}</b></div>
            <div><span>Turn surcharge</span><b>{(CFG.TURN_BASE / chassis.movement).toFixed(2)}</b></div>
            <div><span>Fresh digs available</span><b>~{Math.floor(chassis.fuelCap / (1 / chassis.speed + CFG.DIG_FUEL))}</b></div>
            <div><span>Sink</span><b>{chassis.sinkCap}</b></div>
            <div><span>Ping range</span><b>{chassis.sensorRange.toFixed(1)} cells</b></div>
            <div><span>Fix accuracy</span><b>±{chassis.sensorBlur.toFixed(1)}</b></div>
            <div><span>Ping cost</span><b>{chassis.pingFuel.toFixed(1)} fuel</b></div>
            <div><span>Grade estimate</span><b>±{(chassis.analyser / 2).toFixed(1)} tiers</b></div>
          </div>
        </div>
      </main>
    </div>
  );
}

function effectsText(effects: Partial<Record<StatKey, number>>): string {
  return Object.entries(effects)
    .map(([k, v]) => `${(v ?? 0) > 0 ? '+' : ''}${v} ${k}`)
    .join('  ');
}
