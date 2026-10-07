import Link from "next/link";
import { currentPlayer } from "@/lib/auth";
import { getOrCreateCharacter } from "@/lib/characters";
import { listSites } from "@/lib/sites";
import {
  computeChassisForProxy,
  loadCatalog,
  loadInventory,
} from "@/lib/mining-inventory";
import { categoryFitsSlot, listProxies, loadSlots } from "@/lib/proxies";
import { scrapValue } from "@/lib/mechanic";
import { ProxyManager } from "@/components/ProxyManager";

// Proxy management — lives outside the sites, like /inventory, since your
// chassis belong to the character, not to any one site. Lists every chassis
// you own; each can be renamed, assigned to an activity, loaded with gear
// from your shared inventory, or scrapped. Buying new chassis and adding
// slots happens at the Mechanic site. Mining only for now: refining still
// uses its own rig (see RigScreen). Server component for the auth-gated
// data; the interactive parts are client-side (ProxyManager).
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

  const characterId = await getOrCreateCharacter(player.id, "Pilot");
  const [proxies, catalog, inventory, sites] = await Promise.all([
    listProxies(characterId),
    loadCatalog("extraction"),
    loadInventory(player.id, "extraction"),
    listSites(),
  ]);

  const chassis = await Promise.all(
    proxies.map(async (p) => {
      const [slots, stats] = await Promise.all([
        loadSlots(p.id),
        computeChassisForProxy(p.id),
      ]);
      return {
        id: p.id,
        name: p.name,
        assigned: p.assigned,
        slots,
        stats,
        scrapValue: scrapValue(p.standard + p.carriage),
      };
    }),
  );

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

  const mechanicSiteId =
    sites.find((s) => s.activity_type === "mechanic")?.id ?? null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <ProxyManager
        chassis={chassis}
        items={items}
        owned={owned}
        mechanicSiteId={mechanicSiteId}
      />
    </div>
  );
}
