import { sql } from '@/db/client';
import { CFG, atBase, heldUnits, returnCost } from './mining-engine';
import type { Cell, Chassis, Contact, DirKey, LogEntry, OreLoad, RunState, RunStatus, SurveyTier } from './mining-engine';

// Server-side row for an in-progress run. `state` is the full authoritative
// RunState (only present once phase === 'active') — this never leaves the
// server whole; see toPublicView() for what the client actually receives.
export interface RunRow {
  id: string;
  player_id: string;
  game: string;
  seed: number;
  phase: 'fitting' | 'active';
  alloc: unknown;
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

function deserializeState(raw: unknown): RunState {
  const parsed = raw as Omit<RunState, 'seen'> & { seen: number[] };
  return { ...parsed, seen: new Set(parsed.seen) } as RunState;
}

export async function loadFittingRun(id: string, playerId: string): Promise<RunRow | null> {
  const [row] = await sql`
    select id, player_id, game, seed, phase, alloc, claim, survey, state
    from in_progress_runs
    where id = ${id} and player_id = ${playerId} and phase = 'fitting'
  `;
  return (row as RunRow) ?? null;
}

export async function loadActiveRun(id: string, playerId: string): Promise<{ row: RunRow; state: RunState } | null> {
  const [row] = await sql`
    select id, player_id, game, seed, phase, alloc, claim, survey, state
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
export async function saveActiveState(id: string, expectedStep: number, next: RunState): Promise<boolean> {
  const [row] = await sql`
    update in_progress_runs
    set state = ${serializeState(next)}::jsonb, updated_at = now()
    where id = ${id} and (state->>'step')::int = ${expectedStep}
    returning id
  `;
  return !!row;
}

export interface PublicCell {
  x: number; y: number; known: boolean;
  tier: number; units: number; hazard: number; gas: boolean; seam: boolean; cavern: boolean; dug: boolean;
}

// Never send anything about a cell the player hasn't actually seen. Kept as
// a dense, position-indexed array (not filtered down to only-known) so the
// client's existing idx()/cellAt() indexing keeps working unmodified —
// redacted cells render identically to how "unknown" cells already render.
function redactCells(cells: Cell[]): PublicCell[] {
  return cells.map(c => c.known
    ? { x: c.x, y: c.y, known: true, tier: c.tier, units: c.units, hazard: c.hazard, gas: c.gas, seam: c.seam, cavern: c.cavern, dug: c.dug }
    : { x: c.x, y: c.y, known: false, tier: 0, units: 0, hazard: 0, gas: false, seam: false, cavern: false, dug: false });
}

export interface PublicRunView {
  runId: string;
  x: number; y: number; dir: DirKey | null;
  base: { x: number; y: number };
  fuel: number; sink: number; energy: number; energyStart: number;
  chassis: Chassis;
  carrying: OreLoad[]; banked: OreLoad[];
  trip: number; survey: SurveyTier; pings: number; pingReady: number; step: number;
  contacts: Contact[]; bearing: { dir: string; mass: number } | null;
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
    x: s.x, y: s.y, dir: s.dir,
    base: s.base,
    fuel: s.fuel, sink: s.sink, energy: s.energy, energyStart: s.energyStart,
    chassis: s.chassis,
    carrying: s.carrying, banked: s.banked,
    trip: s.trip, survey: s.survey, pings: s.pings, pingReady: s.pingReady, step: s.step,
    contacts: s.contacts, bearing: s.bearing,
    cells: redactCells(s.cells),
    log: s.log,
    status: s.status,
    homeCost: s.status === 'active' ? returnCost(s, s.x, s.y) : 0,
  };
}

// Shared load -> apply -> save-with-conflict-check pattern for move/extract/ping.
export type ActiveActionResult =
  | { kind: 'ok'; view: PublicRunView; err?: string }
  | { kind: 'not_found' }
  | { kind: 'conflict' };

export async function applyActiveAction(
  id: string,
  playerId: string,
  apply: (state: RunState) => { s: RunState; err?: string }
): Promise<ActiveActionResult> {
  const loaded = await loadActiveRun(id, playerId);
  if (!loaded) return { kind: 'not_found' };
  const expectedStep = loaded.state.step;
  const r = apply(loaded.state);
  const saved = await saveActiveState(id, expectedStep, r.s);
  if (!saved) return { kind: 'conflict' };
  return { kind: 'ok', view: toPublicView(id, r.s), err: r.err };
}

export { CFG, atBase, heldUnits };
