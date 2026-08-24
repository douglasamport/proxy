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
