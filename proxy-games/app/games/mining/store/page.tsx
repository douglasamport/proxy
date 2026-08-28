'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StatKey } from '@/lib/mining-engine';
import type { CatalogItem, InventoryRow } from '@/lib/mining-inventory';
import { categoryIcon } from '../icons';
import '../mining.css';

// Not imported as a value from lib/mining-inventory.ts — that module pulls
// in the DB client, which has no business in a client bundle. It's just a
// string key, duplicated here the same way 'mining' (the game slug) is.
const EXPANSION_KEY = 'chassis_expansion';
const EQUIPMENT_SLOT_KEY = 'equipment_slot_unlock';
const ALL = '__all__';

// No real art yet for most items — a placeholder keeps the layout spot
// reserved so dropping in real image_url values later is a data change,
// not a UI one.
function imgSrc(item: CatalogItem): string {
  return item.image_url || `https://placehold.co/72x72/1B222B/54C6DC?text=${encodeURIComponent(item.label.slice(0, 2).toUpperCase())}`;
}

// Buy inventory here; equip it on the build screen. Kept as two screens
// (not folded together) because owning and fitting are different
// decisions — you might stockpile items you don't equip yet.
export default function StorePage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [filter, setFilter] = useState<string>(ALL);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');

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
  }, []);

  const didLoadRef = useRef(false);
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    load();
  }, [load]);

  const ownedByKey = new Map(inventory.map(r => [r.item_key, r.owned_quantity]));
  const funds = balance ? Number(balance) : 0;

  const categories = useMemo(() => Array.from(new Set(catalog.map(c => c.category))), [catalog]);
  const shown = useMemo(
    () => (filter === ALL ? catalog : catalog.filter(c => c.category === filter)),
    [catalog, filter]
  );

  async function buy(itemKey: string) {
    setBusyKey(itemKey);
    setError('');
    const res = await fetch('/api/store/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'mining', item_key: itemKey, quantity: 1 }),
    });
    setBusyKey(null);
    if (!res.ok) {
      setError(res.status === 402 ? 'Not enough balance for that.' : 'Could not complete purchase — try again.');
      return;
    }
    await load();
  }

  // Separate from buy(): price isn't flat here, it doubles with each one
  // already owned, so it hits its own endpoint (see /api/store/expand).
  async function buyExpansion() {
    setBusyKey(EXPANSION_KEY);
    setError('');
    const res = await fetch('/api/store/expand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'mining' }),
    });
    setBusyKey(null);
    if (!res.ok) {
      setError(res.status === 402 ? 'Not enough balance for that.' : 'Could not complete purchase — try again.');
      return;
    }
    await load();
  }

  // One-time only, unlike the expansion above — see /api/store/equipment-slot.
  async function buyEquipmentSlot() {
    setBusyKey(EQUIPMENT_SLOT_KEY);
    setError('');
    const res = await fetch('/api/store/equipment-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'mining' }),
    });
    setBusyKey(null);
    if (!res.ok) {
      setError(res.status === 402 ? 'Not enough balance for that.' : 'Could not complete purchase — try again.');
      return;
    }
    await load();
  }

  if (authRequired) {
    return (
      <div className="mining-root">
        <header><div className="brand">Extraction <span>/ store</span></div></header>
        <main className="fit-layout">
          <div className="fit-controls sect">
            <div className="lbl">Sign in required</div>
            <p>The store is tied to your account balance.</p>
            <a className="go" href="/login" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>Sign in</a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="mining-root">
      <header>
        <div className="brand">Extraction <span>/ store</span></div>
        <div className="seedline">balance {balance ?? '—'}</div>
        <a className="hbtn" href="/games/mining/build" style={{ textDecoration: 'none' }}>Build</a>
        <a className="hbtn" href="/games/mining" style={{ textDecoration: 'none' }}>Back to run</a>
      </header>

      <main className="store-layout">
        {error && <div className="ptip" style={{ color: 'var(--danger)' }}>{error}</div>}

        <div className="filter-bar">
          <button className={`filter-btn ${filter === ALL ? 'on' : ''}`} onClick={() => setFilter(ALL)}>
            All
          </button>
          {categories.map(cat => {
            const Icon = categoryIcon(cat);
            return (
              <button key={cat} className={`filter-btn ${filter === cat ? 'on' : ''}`} onClick={() => setFilter(cat)}>
                <Icon /> {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            );
          })}
        </div>

        <div className="store-grid">
          {shown.map(item => {
            const owned = ownedByKey.get(item.item_key) ?? 0;
            const isExpansion = item.item_key === EXPANSION_KEY;
            const isEquipmentSlot = item.item_key === EQUIPMENT_SLOT_KEY;
            const alreadyOwned = isEquipmentSlot && owned >= 1;
            const cost = isExpansion ? Number(item.cost) * 2 ** owned : Number(item.cost);
            const busy = busyKey === item.item_key;
            return (
              <div className="item-card" key={item.item_key}>
                <div className="item-head">
                  {/* eslint-disable-next-line @next/next/no-img-element -- placeholder art until item_catalog.image_url is populated */}
                  <img className="item-thumb" src={imgSrc(item)} alt="" width={72} height={72} />
                  <div>
                    <div className="item-label">{item.label}</div>
                    {item.description && <div className="item-desc">{item.description}</div>}
                    {Object.keys(item.effects).length > 0 && <div className="item-effects">{effectsText(item.effects)}</div>}
                  </div>
                  <button
                    className="hbtn buybtn"
                    onClick={() => (isExpansion ? buyExpansion() : isEquipmentSlot ? buyEquipmentSlot() : buy(item.item_key))}
                    disabled={busy || alreadyOwned || cost > funds}
                  >
                    {alreadyOwned ? 'Owned' : `Buy · ${cost}`}
                  </button>
                </div>
                <div className="item-owned">
                  {isExpansion ? `slots added ${owned}` : isEquipmentSlot ? (alreadyOwned ? 'unlocked' : 'not yet unlocked') : `owned ${owned}`}
                </div>
              </div>
            );
          })}
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
