// The whole point of the shell: adding a game is adding one entry here and
// dropping its page in app/games/<slug>/page.tsx. Nothing about auth, the
// runs table, or the leaderboard needs to know a new game exists.
//
// `slug` is what gets written into runs.game — keep it stable forever once
// a game ships, since old rows reference it by string.

export type GameMeta = {
  slug: string;
  title: string;
  tagline: string;
  status: 'live' | 'coming_soon';
};

export const GAMES: GameMeta[] = [
  {
    slug: 'mining',
    title: 'Extraction',
    tagline: 'One tank of fuel. Fog of war. Find out what you can carry home.',
    status: 'live',
  },
  // Next game goes here. Nothing else in the app changes.
  // { slug: 'combat', title: '…', tagline: '…', status: 'coming_soon' },
];

export function getGame(slug: string) {
  return GAMES.find((g) => g.slug === slug) ?? null;
}
