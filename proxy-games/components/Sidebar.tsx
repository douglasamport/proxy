import Link from "next/link";
import { currentPlayer } from "@/lib/auth";
import { getCharacter } from "@/lib/characters";
import { getEnergy } from "@/lib/energy";
import { listSites } from "@/lib/sites";
import SidebarItem from "./SidebarItem";

const LINKABLE = new Set(["extraction", "refining"]);

// Master sidebar, rendered from the root layout so it's on every page.
// Hidden until the player is signed in AND has finished character setup —
// before that the homepage (Welcome) owns the screen. Placeholder content:
// sites are a flat list for now, no grouping.
export default async function Sidebar() {
  const player = await currentPlayer({ touch: false });
  if (!player) return null;
  const character = await getCharacter(player.id);
  if (!character?.setup_complete) return null;

  const [energy, sites] = await Promise.all([
    getEnergy(character.id),
    listSites(),
  ]);

  console.log(sites);

  const balance = `$${Number(player.balance).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const energyDisp = `⚡ ${Math.floor(energy.current)}/${Math.floor(energy.cap)}`;

  return (
    <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-950 p-4 text-sm">
      <div className="mb-5 space-y-1 rounded-lg border border-slate-800 bg-slate-900 p-3">
        <Link
          href="/"
          className="mb-5 block rounded-lg  px-3 py-2 hover:border-cyan-500"
        >
          {/* <div className="text-[10px] uppercase tracking-widest text-slate-500"></div> */}
          <div className="font-semibold">{character.name}</div>
        </Link>
        <SidebarDisplay name={"Balance"} value={balance} />
        <SidebarDisplay name={"Energy"} value={energyDisp} />
      </div>

      <ul className="mb-5 space-y-1">
        <SidebarItem href="/inventory">Inventory</SidebarItem>
      </ul>

      <div className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">
        Sites
      </div>
      <ul className="space-y-1">
        {sites.map((site) => (
          <SidebarItem
            key={site.id}
            href={
              LINKABLE.has(site.activity_type) ? `/site/${site.id}` : undefined
            }
          >
            {site.name}
          </SidebarItem>
        ))}
      </ul>
    </aside>
  );
}

function SidebarDisplay({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{name}</span>
      <b className="font-mono text-cyan-400">{value}</b>
    </div>
  );
}
