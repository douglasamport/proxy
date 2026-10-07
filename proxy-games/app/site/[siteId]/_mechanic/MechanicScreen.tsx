import { currentPlayer } from "@/lib/auth";
import { getOrCreateCharacter } from "@/lib/characters";
import { countInstalledByItem, listProxies } from "@/lib/proxies";
import { loadCatalog, loadInventory } from "@/lib/mining-inventory";
import { expansionCost, loadMechanicPrices } from "@/lib/mechanic";
import { MechanicShop } from "@/components/MechanicShop";

// The Mechanic's one page: buy a new chassis, or add slots / an equipment
// bay to a specific chassis you own. Server component for the data (prices
// and slot counts come from the database, never from the client); the
// buttons live in MechanicShop. Signed-out visitors see the site shell's
// sign-in gate instead (its inventory fetch 401s).
export async function MechanicScreen({ siteId }: { siteId: string }) {
  const player = await currentPlayer({ touch: false });
  if (!player) return null;

  const characterId = await getOrCreateCharacter(player.id, "Pilot");
  const [chassis, prices, catalog, inventory, installed] = await Promise.all([
    listProxies(characterId),
    loadMechanicPrices(),
    loadCatalog("mechanic"),
    loadInventory(player.id),
    countInstalledByItem(characterId),
  ]);
  const ownedByKey = new Map(inventory.map((r) => [r.item_key, r.owned_quantity]));

  // Field equipment the Mechanic carries (ore siphon, line scanner): the
  // one catalog category here that's an ordinary buy/sell item.
  const equipment = catalog
    .filter((c) => c.category === "equipment")
    .map((c) => {
      const owned = ownedByKey.get(c.item_key) ?? 0;
      return {
        item_key: c.item_key,
        label: c.label,
        description: c.description,
        cost: Number(c.cost),
        sellPrice:
          c.sellable && c.sell_value != null
            ? Number(c.cost) * Number(c.sell_value)
            : null,
        owned,
        // fitted copies can't be sold until removed from their chassis
        sellable: Math.max(0, owned - (installed[c.item_key] ?? 0)),
      };
    });

  return (
    <MechanicShop
      siteId={siteId}
      balance={Number(player.balance)}
      prices={prices}
      equipment={equipment}
      chassis={chassis.map((c) => ({
        ...c,
        nextSlotCost:
          prices.expansion == null
            ? null
            : expansionCost(prices.expansion, c.standard),
      }))}
    />
  );
}
