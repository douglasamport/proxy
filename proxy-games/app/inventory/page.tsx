import Link from 'next/link';
import { currentPlayer } from '@/lib/auth';
import { loadCatalog, loadInventory } from '@/lib/mining-inventory';
import { InventoryGrid } from './InventoryGrid';
import type { OwnedItem } from './InventoryGrid';

// Everything a player owns, across every item they've bought — separate
// from the build screen (which is about equipping a run's chassis) and the
// store (buying more). Only 'mining' has a catalog today; this'll want a
// loop over active games once there's a second one with its own store.
// Stays a server component for the auth-gated data fetch; the filter bar
// itself is client-side (see InventoryGrid.tsx).
export default async function InventoryPage() {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-4 text-2xl font-bold">Sign in required</h1>
        <p className="mb-6 text-slate-400">Your inventory is tied to your account.</p>
        <Link href="/login" className="inline-block rounded bg-cyan-600 px-4 py-2 font-semibold text-slate-950">
          Sign in
        </Link>
      </div>
    );
  }

  const [catalog, inventory] = await Promise.all([
    loadCatalog('mining'),
    loadInventory(player.id),
  ]);
  const byKey = new Map(catalog.map(c => [c.item_key, c]));
  const items: OwnedItem[] = inventory
    .filter(r => r.owned_quantity > 0)
    .map(r => {
      const item = byKey.get(r.item_key);
      if (!item) return null;
      return {
        item_key: item.item_key,
        category: item.category,
        label: item.label,
        description: item.description,
        image_url: item.image_url,
        owned_quantity: r.owned_quantity,
        equipped_quantity: r.equipped_quantity,
      };
    })
    .filter((x): x is OwnedItem => x !== null);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/games/mining/build" className="rounded border border-slate-800 px-3 py-1.5 hover:border-cyan-500">
            Build
          </Link>
          <Link href="/games/mining/store" className="rounded border border-slate-800 px-3 py-1.5 hover:border-cyan-500">
            Store
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-slate-400">
          You don&rsquo;t own anything yet. Visit the{' '}
          <Link href="/games/mining/store" className="text-cyan-400 underline">
            store
          </Link>{' '}
          to get started.
        </p>
      ) : (
        <InventoryGrid items={items} />
      )}
    </div>
  );
}
