import { currentPlayer } from "@/lib/auth";
import Link from "next/link";
// import './globals.css';

// The shared shell every game renders inside. One nav, one identity, one
// account menu — this is what "shared player ID and shared UI" means in code.
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const player = await currentPlayer();

  return (
    <html lang="en">
      <body>
        <header className="shell-nav">
          <Link href="/" className="brand">
            Proxy Games
          </Link>
          <nav>
            <Link href="/games">Games</Link>
            {player ? (
              <div className="account">
                <span>{player.display_name ?? player.email}</span>
                <form action="/api/auth/logout" method="POST">
                  <button type="submit">Sign out</button>
                </form>
              </div>
            ) : (
              <Link href="/login">Sign in</Link>
            )}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
