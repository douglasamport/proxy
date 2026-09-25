import Link from "next/link";
import { currentPlayer } from "@/lib/auth";
import { getOrCreateCharacter } from "@/lib/characters";
import { getEnergy } from "@/lib/energy";

function formatBalance(balance: string | undefined) {
  const n = balance ? Number(balance) : 0;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Two rows: a nav bar (brand + auth on the left, links on the right) and a
// user bar underneath (identity + balance + energy, shared across every
// game — see db/002_balance.sql and db/022_energy.sql). Logo art is still
// a placeholder; balance and energy are real. Energy is a server-rendered
// snapshot like balance is — it doesn't tick up live between page loads,
// it just reflects whatever it actually was at render time (regen is
// lazy, computed on read — see lib/energy.ts). Mining/refine call
// router.refresh() after anything that spends either so this stays
// current right after a launch, same pattern balance already used.
export default async function Header() {
  const player = await currentPlayer();
  const energy = player
    ? await getEnergy(await getOrCreateCharacter(player.id, "Pilot"))
    : null;

  return (
    <header className="site-header">
      <div className="nav-bar">
        <div className="nav-left">
          <span className="logo-placeholder" aria-hidden="true" />
          <Link href="/" className="brand">
            Proxy Games
          </Link>
          {player ? (
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="auth-link">
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="auth-link">
              Sign in
            </Link>
          )}
        </div>
        <nav className="nav-right">
          <Link href="/games">Games</Link>
        </nav>
      </div>
      <div className="user-bar">
        <span className="user-name">
          {player ? (player.display_name ?? player.email) : "Guest"}
        </span>
        <div className="user-bar-right">
          <Link href="/games/refine" className="user-link">
            Refine
          </Link>
          <Link href="/games/mining" className="user-link">
            Extraction
          </Link>
          <Link href="/inventory" className="user-link">
            Inventory
          </Link>
          {energy && (
            <span className="user-energy" title={`${Math.floor(energy.cap)} max`}>
              ⚡ {Math.floor(energy.current)} / {Math.floor(energy.cap)}
            </span>
          )}
          <span className="user-balance">
            ${formatBalance(player?.balance)}
          </span>
        </div>
      </div>
    </header>
  );
}
