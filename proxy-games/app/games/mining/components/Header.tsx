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
        <nav className="nav-right">
          <Link href="/games">Games</Link>
        </nav>
      </div>
      <div className="user-bar">
        <span className="user-name">
          {player ? (player.display_name ?? player.email) : "Guest"}
        </span>
        <div className="user-bar-right">
          <Link href="/inventory" className="user-link">
            Inventory
          </Link>
          <span className="user-balance">${formatBalance(player?.balance)}</span>
        </div>
      </div>
    </header>
  );
}
