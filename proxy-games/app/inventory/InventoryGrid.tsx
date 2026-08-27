'use client';

import { useMemo, useState } from 'react';
import { categoryIcon } from '@/app/games/mining/icons';

export interface OwnedItem {
  item_key: string;
  category: string;
  label: string;
  description: string | null;
  image_url: string | null;
  owned_quantity: number;
  equipped_quantity: number;
}

const ALL = '__all__';
const EXPANSION_KEY = 'chassis_expansion';

function imgSrc(item: OwnedItem): string {
  return item.image_url || `https://placehold.co/120x120?text=${encodeURIComponent(item.label.slice(0, 2).toUpperCase())}`;
}

// Client-only for the category filter bar — the page itself stays a server
// component for the auth-gated data fetch (see app/inventory/page.tsx).
export function InventoryGrid({ items }: { items: OwnedItem[] }) {
  const [filter, setFilter] = useState<string>(ALL);
  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category))), [items]);
  const shown = filter === ALL ? items : items.filter(i => i.category === filter);

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
            filter === ALL ? 'border-cyan-500 bg-cyan-950 text-cyan-300' : 'border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          onClick={() => setFilter(ALL)}
        >
          All
        </button>
        {categories.map(cat => {
          const Icon = categoryIcon(cat);
          return (
            <button
              key={cat}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                filter === cat ? 'border-cyan-500 bg-cyan-950 text-cyan-300' : 'border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setFilter(cat)}
            >
              <Icon /> {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {shown.map(item => (
          <div key={item.item_key} className="flex gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- placeholder art until item_catalog.image_url is populated */}
            <img src={imgSrc(item)} alt="" width={64} height={64} className="h-16 w-16 flex-none rounded-md object-cover" />
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{item.label}</h2>
                <span className="text-xs uppercase tracking-wide text-slate-500">{item.category}</span>
              </div>
              {item.description && <p className="text-sm text-slate-400">{item.description}</p>}
              <p className="mt-2 text-sm text-slate-300">
                {item.item_key === EXPANSION_KEY ? (
                  <>Slots added <b className="text-cyan-400">{item.owned_quantity}</b></>
                ) : (
                  <>
                    Owned <b className="text-cyan-400">{item.owned_quantity}</b> · Equipped{' '}
                    <b className="text-cyan-400">{item.equipped_quantity}</b>
                  </>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
