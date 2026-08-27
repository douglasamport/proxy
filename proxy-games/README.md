# Scaffold — shared shell, auth, runs, leaderboard

Drop this into `/Users/bitterandesters/amport/proxy/proxy-mine`. Paths assume
Next.js App Router with the `@/` alias pointed at the project root (default
in `create-next-app`).

## What's here

```
db/
  001_init.sql       run this against Neon once (psql, or Neon's SQL editor)
  client.ts          pooled Postgres client — import { sql } from '@/db/client'
lib/
  auth.ts            magic-link request/verify, session lookup
  mail.ts            sends the login email (Resend by default; swap freely)
app/
  layout.tsx          the shared shell — nav, account state, wraps every page
  games/
    registry.ts        <- add a game here, nowhere else
    page.tsx            the hub listing every game
  api/
    auth/request/       POST { email } -> sends magic link
    auth/verify/         GET ?token=... -> sets session, redirects
    runs/                POST save a run (requires session) / GET own history
    leaderboard/[game]/[seed]/   GET best-per-player on one seed
```

## What's deliberately NOT here

- `app/games/mining/page.tsx` — that's your existing `run-prototype.html`'s
  logic ported into a React page, or embedded as-is in an iframe for a first
  pass. Wiring the actual game UI to `POST /api/runs` is the next step once
  this scaffold is in place.
- Any UI styling beyond a `globals.css` you'll write yourself.
- Rate limiting on `/api/auth/request` — add this before it's public. Anyone
  can currently spam an email address with login links.
- Server-side score verification. `POST /api/runs` trusts the client's
  reported score. Fine for now; see the comment in that file for when to
  stop trusting it.

## Environment variables

```
DATABASE_URL=postgres://...-pooler.../db?sslmode=require   # Neon POOLED string
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
RESEND_API_KEY=...        # omit locally — auth.ts logs the link to console instead
MAIL_FROM=login@yourdomain.com
```

## The one rule worth keeping

`runs.game` is the only thing that knows which game a row belongs to.
Auth, sessions, and the leaderboard query never hardcode "mining" — check
`app/api/runs/route.ts` and the leaderboard route to confirm before adding
game #2. If a new game requires touching either of those files, something
has leaked out of the registry pattern and is worth fixing before it repeats.

## Cron

Nothing here needs a scheduled job yet — the flat daily-energy design from
Mechanics v1 hasn't been wired in. When it is, that's where a Railway cron
or a free-tier scheduler triggers the daily reset; this scaffold has
nowhere that assumes a particular cron provider.

## Roadmap

Ordered by what's best for gameplay, not by what's easiest to build.
Organizing the run into sections is deliberately first — everything below it
either extends that flow or needs it stable before it's worth building on.

2. **Basic tutorial.** Once the run has real sections, walk a new player
   through them once — what a claim is, what a survey buys you, why
   tunnels matter, how a run ends. Cheap to build against a sectioned
   flow; expensive to maintain if built before the flow settles, so it
   comes right after #1 and gets revisited once hazards/bonuses and the
   store below exist.

3. **Hazards and bonuses.** The engine already generates hazard cells and
   gas pockets ([app/games/mining/engine.ts](app/games/mining/engine.ts),
   see `CFG.GAS_PER_100`/`CFG.GAS_MULT` and the hazard rolls inside
   `generateField`), but there's no genuine "bonus" side yet — no lucky
   pockets, temporary buffs, or upside to balance the risk. Expand hazard
   variety and add real bonus mechanics to deepen the core run loop now
   that runs have real stakes.

4. **Equipment store.** Spend the now-real currency on upgrades or slots
   that persist between runs, instead of every run starting from the
   same preset allocation. This is what makes money something to build
   toward, not just a number that goes up.

5. **Levels.** A progression layer on top of currency + store +
   hazards/bonuses — needs its own design pass on what a level actually
   gates or unlocks. Placed last because it depends on the systems above
   being in place to have anything meaningful to progress through.
