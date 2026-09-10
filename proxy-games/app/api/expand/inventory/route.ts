import { NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { computeChassis, grantStarterKit, loadCatalog, loadInventory } from '@/lib/land-clearing-inventory';
import { getActiveProxy, getSlotTotal, getWeaponMountTotal } from '@/lib/proxy-store';

const GAME = 'land_clearing';

// GET -> { catalog, inventory, balance, chassis, slotTotal, equipmentSlotTotal, proxyId }
// `equipmentSlotTotal` is actually the weapon_mounts pool here (a separate
// slot pool from the general one, same idea as mining's equipment bay —
// see components/game-shell/InventoryContext.tsx's `equipmentCategories`
// prop, which land-clearing points at weapon/ranged/aoe instead of
// mining's 'equipment').
// Same shared-read shape as GET /api/inventory, land-clearing's own copy
// because its chassis math (StatKey, baseline, categories) is entirely
// separate from mining's — see lib/land-clearing-inventory.ts.
export async function GET() {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const proxy = await getActiveProxy(player.id, GAME);
  let inventory = await loadInventory(player.id, proxy.id);
  // Lazy starter kit: a player who owns nothing at all for this game yet
  // (first touch of land-clearing) gets the bare minimum to not launch
  // with a fully non-functional chassis — see STARTER_KIT's comment.
  // grantStarterKit's inserts are all "on conflict do nothing", so this is
  // safe to gate on "owns nothing" rather than tracking a separate flag.
  if (inventory.length === 0) {
    await grantStarterKit(player.id, proxy.id);
    inventory = await loadInventory(player.id, proxy.id);
  }

  const [catalog, chassis, slotTotal, equipmentSlotTotal] = await Promise.all([
    loadCatalog(GAME),
    computeChassis(proxy.id),
    getSlotTotal(proxy.id),
    getWeaponMountTotal(proxy.id),
  ]);

  return NextResponse.json({
    catalog, inventory, balance: player.balance, chassis, slotTotal, equipmentSlotTotal, proxyId: proxy.id,
  });
}
