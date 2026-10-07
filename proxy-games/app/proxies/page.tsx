import Link from "next/link";
import { currentPlayer } from "@/lib/auth";
import {
  computeChassis,
  loadCatalog,
  loadInventory,
  resolveMiningProxy,
} from "@/lib/mining-inventory";
import { loadProxyName, loadSlots, categoryFitsSlot } from "@/lib/proxies";
import { ProxyManager } from "@/components/ProxyManager";

// Proxy management — lives outside the sites, like /inventory, since a
// chassis belongs to the character and is shared by every extraction site.
// Mining only for now: refining still has its own rig (see RigScreen) that
// hasn't moved onto proxies/chassis_slots. Server component for the
// auth-gated data; the slot picker itself is client-side (ProxyManager).
export default async function ProxiesPage() {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-4 text-2xl font-bold">Sign in required</h1>
        <p className="mb-6 text-slate-400">
          Your proxies are tied to your account.
        </p>
        <Link
          href="/login"
          className="inline-block rounded bg-cyan-600 px-4 py-2 font-semibold text-slate-950"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const { proxyId } = await resolveMiningProxy(player.id);
  const [name, slots, catalog, inventory, chassis] = await Promise.all([
    loadProxyName(proxyId),
    loadSlots(proxyId),
    loadCatalog("extraction"),
    loadInventory(player.id, "extraction"),
    computeChassis(player.id),
  ]);

  // Only items that can go in some slot — ore, licences and capacity
  // unlocks are never equippable.
  const items = catalog
    .filter(
      (c) =>
        categoryFitsSlot(c.category, "standard") ||
        categoryFitsSlot(c.category, "carriage"),
    )
    .map((c) => ({
      item_key: c.item_key,
      label: c.label,
      category: c.category,
      description: c.description,
      image_url: c.image_url,
      effects: c.effects,
    }));
  const owned = Object.fromEntries(
    inventory.map((r) => [r.item_key, r.owned_quantity]),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <ProxyManager
        proxyName={name ?? "Mining Chassis"}
        slots={slots}
        items={items}
        owned={owned}
        chassis={chassis}
      />
    </div>
  );
}
