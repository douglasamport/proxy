import { randomUUID } from "crypto";
import { sql } from "@/db/client";
import {
  CFG,
  atBase,
  heldUnits,
  oreGradeValue,
  returnCost,
  runAI,
  score,
} from "./mining-engine";
import type {
  Cell,
  Chassis,
  Contact,
  DirKey,
  LogEntry,
  OreLoad,
  OreTypeKey,
  RunState,
  RunStatus,
  ScoreResult,
  SurveyTier,
} from "./mining-engine";

// Server-side row for an in-progress run. `state` is the full authoritative
// RunState (only present once phase === 'active') — this never leaves the
// server whole; see toPublicView() for what the client actually receives.
export interface RunRow {
  id: string;
  player_id: string;
  game: string;
  seed: number;
  phase: "fitting" | "active";
  loadout: { item_key: string; quantity: number }[] | null;
  claim: number | null;
  survey: SurveyTier;
  state: unknown;
}

// jsonb round-trip: RunState.seen is a Set, which JSON can't represent —
// convert to/from a plain array. _home/_homeStep are a per-request cache
// (see mining-engine.ts) and don't need to survive a save/load cycle.
function serializeState(s: RunState): string {
  const { _home, _homeStep, seen, ...rest } = s;
  return JSON.stringify({ ...rest, seen: Array.from(seen) });
}

// Map size now varies per run (see Stage 6 of build-spec-ore-progression.md
// — field dims depend on the player's unlocked minerals at launch time).
// generateField/idx/inBounds/etc all read the shared CFG.W/CFG.H global
// rather than taking dims as a parameter (see mining-engine.ts), so every
// engine call against a *loaded* run has to re-sync that global from the
// state it just loaded, the same way createRun() sets it at creation. Safe
// only because this sync and the engine call that follows always happen in
// the same synchronous stretch, with no `await` between them — Node never
// interleaves another request's code into that gap.
function deserializeState(raw: unknown): RunState {
  const parsed = raw as Omit<RunState, "seen"> & { seen: number[] };
  const state = { ...parsed, seen: new Set(parsed.seen) } as RunState;
  // Rows saved before Stage 6 predate these fields — every field that ever
  // existed pre-Stage-6 was generated at exactly the base block size with
  // only copper, so that's the correct fallback, not an arbitrary default.
  state.w ??= CFG.BLOCK_W;
  state.h ??= CFG.BLOCK_H;
  state.unlockedOreTypes ??= ["copper"];
  CFG.W = state.w;
  CFG.H = state.h;
  return state;
}

export async function loadFittingRun(
  id: string,
  playerId: string,
): Promise<RunRow | null> {
  const [row] = await sql`
    select id, player_id, game, seed, phase, loadout, claim, survey, state
    from in_progress_runs
    where id = ${id} and player_id = ${playerId} and phase = 'fitting'
  `;
  return (row as RunRow) ?? null;
}

export async function loadActiveRun(
  id: string,
  playerId: string,
): Promise<{ row: RunRow; state: RunState } | null> {
  const [row] = await sql`
    select id, player_id, game, seed, phase, loadout, claim, survey, state
    from in_progress_runs
    where id = ${id} and player_id = ${playerId} and phase = 'active'
  `;
  if (!row) return null;
  return { row: row as RunRow, state: deserializeState((row as RunRow).state) };
}

// Optimistic concurrency: the WHERE clause only matches if `step` is still
// what we read it as. Two concurrent requests against the same run can't
// both win — the loser's update touches 0 rows and gets a conflict instead
// of silently clobbering the winner's state.
export async function saveActiveState(
  id: string,
  expectedStep: number,
  next: RunState,
): Promise<boolean> {
  const [row] = await sql`
    update in_progress_runs
    set state = ${serializeState(next)}::jsonb, updated_at = now()
    where id = ${id} and (state->>'step')::int = ${expectedStep}
    returning id
  `;
  return !!row;
}

export interface PublicCell {
  x: number;
  y: number;
  known: boolean;
  grade: number;
  oreType: OreTypeKey;
  units: number;
  hazard: number;
  gas: boolean;
  seam: boolean;
  cavern: boolean;
  dug: boolean;
}

// Never send anything about a cell the player hasn't actually seen. Kept as
// a dense, position-indexed array (not filtered down to only-known) so the
// client's existing idx()/cellAt() indexing keeps working unmodified —
// redacted cells render identically to how "unknown" cells already render.
function redactCells(cells: Cell[]): PublicCell[] {
  return cells.map((c) =>
    c.known
      ? {
          x: c.x,
          y: c.y,
          known: true,
          grade: c.grade,
          oreType: c.oreType,
          units: c.units,
          hazard: c.hazard,
          gas: c.gas,
          seam: c.seam,
          cavern: c.cavern,
          dug: c.dug,
        }
      : {
          x: c.x,
          y: c.y,
          known: false,
          grade: 0,
          oreType: "copper", // never rendered — grade 0 means "no ore"
          units: 0,
          hazard: 0,
          gas: false,
          seam: false,
          cavern: false,
          dug: false,
        },
  );
}

export interface PublicRunView {
  runId: string;
  w: number;
  h: number;
  x: number;
  y: number;
  dir: DirKey | null;
  base: { x: number; y: number };
  fuel: number;
  sink: number;
  energy: number;
  energyStart: number;
  chassis: Chassis;
  carrying: OreLoad[];
  banked: OreLoad[];
  trip: number;
  survey: SurveyTier;
  pings: number;
  pingReady: number;
  step: number;
  contacts: Contact[];
  bearing: { dir: string; mass: number } | null;
  cells: PublicCell[];
  log: LogEntry[];
  status: RunStatus;
  homeCost: number; // precomputed server-side — see note below
}

// `returnCost` path-finds over the TRUE field (it already routes around
// undiscovered hard seams and accounts for undiscovered caverns — that's
// existing engine behavior, not something introduced here). Redacting cells
// before computing this would give a wrong number, so it's computed once
// server-side against the real state and shipped as a plain figure instead
// of a function the client could call against its necessarily-incomplete view.
export function toPublicView(runId: string, s: RunState): PublicRunView {
  return {
    runId,
    w: s.w,
    h: s.h,
    x: s.x,
    y: s.y,
    dir: s.dir,
    base: s.base,
    fuel: s.fuel,
    sink: s.sink,
    energy: s.energy,
    energyStart: s.energyStart,
    chassis: s.chassis,
    carrying: s.carrying,
    banked: s.banked,
    trip: s.trip,
    survey: s.survey,
    pings: s.pings,
    pingReady: s.pingReady,
    step: s.step,
    contacts: s.contacts,
    bearing: s.bearing,
    cells: redactCells(s.cells),
    log: s.log,
    status: s.status,
    homeCost: s.status === "active" ? returnCost(s, s.x, s.y) : 0,
  };
}

// Shared load -> apply -> save-with-conflict-check pattern for move/extract/ping.
export type ActiveActionResult =
  | { kind: "ok"; view: PublicRunView; err?: string }
  | { kind: "not_found" }
  | { kind: "conflict" };

export async function applyActiveAction(
  id: string,
  playerId: string,
  apply: (state: RunState) => { s: RunState; err?: string },
): Promise<ActiveActionResult> {
  const loaded = await loadActiveRun(id, playerId);
  if (!loaded) return { kind: "not_found" };
  const expectedStep = loaded.state.step;
  const r = apply(loaded.state);
  const saved = await saveActiveState(id, expectedStep, r.s);
  if (!saved) return { kind: "conflict" };
  return { kind: "ok", view: toPublicView(id, r.s), err: r.err };
}

// "collect credits" is the original behaviour: banked ore's cash value is
// credited outright. "stockpile ore" credits nothing for revenue — the run's
// costs (fuel, repair, launch, claim) are still charged, since those were
// spent regardless of what happens to the ore — but the banked ore itself
// goes into player_inventory instead. Per-run, not per-ore-type (see Stage 2
// of build-spec-ore-progression.md).
export type SettleChoice = "credits" | "ore";

// Scores both sides, writes the run + a balance_transactions ledger row +
// the players.balance/player_inventory update atomically, and deletes the
// in_progress_runs row. `state.status` must already be terminal — this
// doesn't call applyEnd(), it settles a run that has already ended one way
// or another. Shared by POST /api/runs/[id]/settle (the player explicitly
// choosing, once they've seen ResultsModal's numbers) and
// settleAbandonedRuns() below (a run that ended and was simply never
// reported — always settled as "credits", since there's no one left to ask).
export async function settleRun(
  row: RunRow,
  state: RunState,
  choice: SettleChoice = "credits",
): Promise<{ you: ScoreResult; ai: ScoreResult }> {
  const you = score(state);
  const ai = score(
    runAI(state.seed, state.chassis, state.energyStart, state.unlockedOreTypes),
  );

  const runId = randomUUID();
  const statements = [
    sql`
      insert into runs (id, player_id, game, seed, config, status, units, grade, net, move_log)
      values (
        ${runId}, ${row.player_id}, ${row.game}, ${state.seed},
        ${JSON.stringify({ loadout: row.loadout, claim: state.energyStart, survey: state.survey, settleChoice: choice })},
        ${state.status}, ${you.units}, ${you.grade}, ${you.net},
        ${JSON.stringify(state.log)}
      )
    `,
  ];

  if (choice === "ore") {
    // Grouped by ore type and valued the same way "collect credits" values
    // it — units * grade value * ORE_PRICE, see score() — then converted
    // into a flat-priced quantity via that ore's item_catalog.sell_value.
    // Dividing by the same price a later sale would use is what makes
    // stockpile-then-sell worth exactly what collecting credits now would
    // have paid (see Stage 3 of build-spec-ore-progression.md: "cash-in
    // price and sell price are identical").
    const revenueByType = new Map<OreTypeKey, number>();
    for (const load of state.banked) {
      const revenue =
        load.units * oreGradeValue(load.oreType, load.grade) * CFG.ORE_PRICE;
      revenueByType.set(
        load.oreType,
        (revenueByType.get(load.oreType) ?? 0) + revenue,
      );
    }
    const oreTypes = Array.from(revenueByType.keys());
    const priceRows = oreTypes.length
      ? await sql`select item_key, sell_value from item_catalog where item_key = any(${oreTypes})`
      : [];
    const sellPriceByType = new Map(
      priceRows.map((r) => [r.item_key as string, Number(r.sell_value)]),
    );
    for (const [oreType, revenue] of revenueByType) {
      const sellPrice = sellPriceByType.get(oreType);
      if (!sellPrice) continue; // not in the catalog / no price set — nothing to stockpile
      const quantity = Math.round(revenue / sellPrice);
      if (quantity <= 0) continue;
      statements.push(sql`
        insert into player_inventory (player_id, item_key, owned_quantity)
        values (${row.player_id}, ${oreType}, ${quantity})
        on conflict (player_id, item_key)
        do update set owned_quantity = player_inventory.owned_quantity + excluded.owned_quantity, updated_at = now()
      `);
    }
    const costOnly = -you.cost;
    statements.push(
      sql`
        insert into balance_transactions (player_id, game, reason, delta, run_id)
        values (${row.player_id}, ${row.game}, 'run_cost', ${costOnly}, ${runId})
      `,
      sql`update players set balance = balance + ${costOnly} where id = ${row.player_id}`,
    );
  } else {
    statements.push(
      sql`
        insert into balance_transactions (player_id, game, reason, delta, run_id)
        values (${row.player_id}, ${row.game}, 'run_net', ${you.net}, ${runId})
      `,
      sql`update players set balance = balance + ${you.net} where id = ${row.player_id}`,
    );
  }

  await sql.transaction(statements);
  await sql`delete from in_progress_runs where id = ${row.id}`;

  return { you, ai };
}

// A run's status can go terminal (fuel dry -> stranded, fatal hazard ->
// wrecked) without the client ever calling /end — blocking that one request
// client-side is all it'd take to dodge a loss forever otherwise. Called
// before handing out a new field (see app/api/runs/field/route.ts) so a
// player can't just walk away from a bad outcome and start fresh unsettled.
// Deliberately does NOT touch rows still genuinely status: 'active' —
// abandoning a run you don't like mid-play has always been free and stays
// that way; this only catches outcomes that already happened.
export async function settleAbandonedRuns(
  playerId: string,
  game: string,
): Promise<void> {
  const rows = await sql`
    select id, player_id, game, seed, phase, loadout, claim, survey, state
    from in_progress_runs
    where player_id = ${playerId} and game = ${game} and phase = 'active'
      and state->>'status' <> 'active'
  `;
  for (const row of rows as RunRow[]) {
    await settleRun(row, deserializeState(row.state));
  }
}

// Settles any abandoned run, clears out any existing fitting-phase row (an
// unlaunched fit — nothing was ever spent on it), and starts a fresh one
// with the given seed. Shared by the "give me a brand new field" actions
// (POST /api/runs/field, dev reseed, refit, play-again) — NOT used for a
// plain resume, which should leave an existing fitting/active run alone.
// See app/api/runs/current/route.ts for the resume-or-create path.
export async function assignNewField(
  playerId: string,
  game: string,
  seed: number,
): Promise<{ runId: string; balance: string }> {
  await settleAbandonedRuns(playerId, game);
  await sql`delete from in_progress_runs where player_id = ${playerId} and game = ${game} and phase = 'fitting'`;

  const [row] = await sql`
    insert into in_progress_runs (player_id, game, seed, phase)
    values (${playerId}, ${game}, ${seed}, 'fitting')
    returning id
  `;

  const [{ balance }] =
    await sql`select balance from players where id = ${playerId}`;
  return { runId: row.id, balance };
}

export type PurchaseResult =
  | { kind: "ok"; balance: string }
  | { kind: "insufficient_funds" }
  | { kind: "not_found" };

// A survey tier is charged immediately on selection now, not folded into
// the run's net at settlement (see the comment on `cost` in score()).
// Deliberately two steps, not one sql.transaction(): a conditional UPDATE
// (`WHERE balance >= cost`) that matches 0 rows doesn't roll back other
// statements in a transaction batch, it just silently no-ops — so the
// balance-check has to gate everything else itself, checked before we do
// anything further. The WHERE clause also means two concurrent purchases
// (two tabs, a fast double-click) can't both succeed off a stale balance.
export async function purchaseSurvey(
  runRowId: string,
  playerId: string,
  game: string,
  tier: SurveyTier,
  cost: number,
): Promise<PurchaseResult> {
  const [deducted] = await sql`
    update players set balance = balance - ${cost}
    where id = ${playerId} and balance >= ${cost}
    returning balance
  `;
  if (!deducted) return { kind: "insufficient_funds" };

  const results = await sql.transaction([
    sql`
      update in_progress_runs set survey = ${tier}, updated_at = now()
      where id = ${runRowId} and player_id = ${playerId} and phase = 'fitting'
      returning id
    `,
    sql`
      insert into balance_transactions (player_id, game, reason, delta)
      values (${playerId}, ${game}, 'survey_purchase', ${-cost})
    `,
  ]);

  const updated = results[0] as { id: string }[];
  if (!updated.length) {
    // The fitting row vanished between load and purchase (refit from
    // another tab, concurrently settled, etc.) — refund rather than
    // silently keep money for a survey that was never actually recorded.
    await sql`update players set balance = balance + ${cost} where id = ${playerId}`;
    return { kind: "not_found" };
  }

  return { kind: "ok", balance: deducted.balance };
}

export { CFG, atBase, heldUnits };
