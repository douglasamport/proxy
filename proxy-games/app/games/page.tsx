import Link from 'next/link';
import { GAMES } from './registry';

// The hub. This is what "exposure across this and future games" looks like
// in practice — every game you ship adds a card here for free, and every
// player who finds you through game #1 sees game #2 the day it exists.
export default function GamesPage() {
  return (
    <div className="games-grid">
      {GAMES.map((g) => (
        <Link key={g.slug} href={`/games/${g.slug}`} className={`game-card ${g.status}`}>
          <h2>{g.title}</h2>
          <p>{g.tagline}</p>
          {g.status === 'coming_soon' && <span className="badge">Coming soon</span>}
        </Link>
      ))}
    </div>
  );
}
