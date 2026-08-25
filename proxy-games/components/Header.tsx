import Link from 'next/link';
import { currentPlayer } from '@/lib/auth';

// Two rows: a nav bar (brand + auth on the left, links on the right) and a
// user bar underneath (identity + balance). Logo art and the balance figure
// are both placeholders until there's real artwork and an economy behind them.
export default async function Header() {
  const player = await currentPlayer();

  return (
    <header className="site-header">
      <div className="nav-bar">
        <div className="nav-left">
          <span className="logo-placeholder" aria-hidden="true" />
          <Link href="/" className="brand">Proxy Games</Link>
          {player ? (
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="auth-link">Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="auth-link">Sign in</Link>
          )}
        </div>
        <nav className="nav-right">
          <Link href="/games">Games</Link>
        </nav>
      </div>
      <div className="user-bar">
        <span className="user-name">{player ? (player.display_name ?? player.email) : 'Guest'}</span>
        <span className="user-balance">$0</span>
      </div>
    </header>
  );
}
