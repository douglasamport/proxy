import Link from 'next/link';
import { GAMES } from './registry';

// The hub. This is what "exposure across this and future games" looks like
// in practice — every game you ship adds a card here for free, and every
// player who finds you through game #1 sees game #2 the day it exists.
export default function GamesPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">Games</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GAMES.map((g) => (
          <Link
            key={g.slug}
            href={`/games/${g.slug}`}
            className={`flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4 transition hover:border-cyan-500 ${
              g.status === 'coming_soon' ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- throwaway placeholder art, swap for next/image once real assets exist */}
            <img
              src={`https://placehold.co/90x90?text=${encodeURIComponent(g.title)}`}
              width={90}
              height={90}
              alt={g.title}
              className="h-[90px] w-[90px] flex-none rounded-md"
            />
            <div className="min-w-0">
              <h2 className="font-semibold">{g.title}</h2>
              <p className="text-sm text-slate-400">{g.tagline}</p>
              {g.status === 'coming_soon' && (
                <span className="mt-1 inline-block rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  Coming soon
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
