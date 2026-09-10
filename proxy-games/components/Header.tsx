import Link from "next/link";
import { currentPlayer } from "@/lib/auth";

function formatBalance(balance: string | undefined) {
  const n = balance ? Number(balance) : 0;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Two rows: a nav bar (brand + auth on the left, links on the right) and a
// user bar underneath (identity + balance, shared across every game — see
// db/002_balance.sql). Logo art is still a placeholder; the balance is real.
export default async function Header() {
  const player = await currentPlayer();

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
        <div className="flex flex-row  gap-4">
          <span className="user-name">
            {player ? (player.display_name ?? player.email) : "Guest"}
          </span>
          <nav className="nav-right">
            <Link href="/games">Games</Link>
          </nav>
        </div>
      </div>
      <div className="flex items-center justify-between px-5 py-[6px] bg-[#12161b] text-[13px] text-[#8a97a3]">
        <div className="flex items-center gap-4">
          <Link href="/games/refine" className="user-link">
            Refine
          </Link>
          <Link href="/games/mining" className="user-link">
            Extraction
          </Link>
          <Link href="/games/expand" className="user-link">
            Expansion
          </Link>
          <Link href="/proxies" className="user-link">
            Hanger
          </Link>
          <Link href="/inventory" className="user-link">
            Inventory
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <span className="user-balance">
            ${formatBalance(player?.balance)}
          </span>
        </div>
      </div>
    </header>
  );
}
