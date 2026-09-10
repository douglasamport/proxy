import { randomUUID } from "crypto";
import { sql } from "@/db/client";
import { isVisibleNow, score } from "./land-clearing-engine";
import type {
  Cell,
  Chassis,
  Entity,
  LogEntry,
  LootDrop,
  RunState,
  RunStatus,
  ScoreResult,
  WildernessEvent,
  Wreck,
} from "./land-clearing-engine";

export const GAME = "land_clearing";

// Server-side row for an in-progress run — same shape/convention as
// lib/mining-run-store.ts's RunRow. `claim` and `survey` are mining-only
// concepts (in_progress_runs is shared across every game); land-clearing
// just leaves them at their column defaults and never reads them.
export interface RunRow {
  id: string;
  player_id: string;
  game: string;
  seed: number;
  phase: "fitting" | "active";
  loadout: { item_key: string; quantity: number }[] | null;
  state: unknown;
}

// No Set/Map fields in RunState (unlike mining's `seen: Set`) — a plain
// JSON round-trip is safe as-is.
function serializeState(s: RunState): string {
  return JSON.stringify(s);
}

function deserializeState(raw: unknown): RunState {
  return raw as RunState;
}

export async function loadFittingRun(
  id: string,
  playerId: string,
): Promise<RunRow | null> {
  const [row] = await sql`
    select id, player_id, game, seed, phase, loadout, state
    from in_progress_runs
    where id = ${id} and player_id = ${playerId} and phase = 'fitting' and game = ${GAME}
  `;
  return (row as RunRow) ?? null;
}

export async function loadActiveRun(
  id: string,
  playerId: string,
): Promise<{ row: RunRow; state: RunState } | null> {
  const [row] = await sql`
    select id, player_id, game, seed, phase, loadout, state
    from in_progress_runs
    where id = ${id} and player_id = ${playerId} and phase = 'active' and game = ${GAME}
  `;
  if (!row) return null;
  return { row: row as RunRow, state: deserializeState((row as RunRow).state) };
}

// Same optimistic-concurrency shape as mining: the WHERE only matches if
// `step` is still what we read it as, so two concurrent actions against the
// same run can't both win.
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

export interface PublicEntity {
  id: number;
  kind: Entity["kind"];
  x: number;
  y: number;
  hp: number;
}

export interface PublicCell {
  x: number;
  y: number;
  seen: boolean;
  obstacle: boolean;
}

// Never send terrain that hasn't been revealed, and never send an entity or
// wreck sitting on a tile that isn't *currently* visible — see
// isVisibleNow() in the engine for why that's a stricter rule than "seen".
function redact(s: RunState): {
  cells: PublicCell[];
  entities: PublicEntity[];
  wrecks: Wreck[];
} {
  const cells: PublicCell[] = s.cells.map((c: Cell) =>
    c.seen
      ? { x: c.x, y: c.y, seen: true, obstacle: c.obstacle }
      : { x: c.x, y: c.y, seen: false, obstacle: false },
  );
  const entities: PublicEntity[] = s.entities
    .filter((e: Entity) => isVisibleNow(s, e.x, e.y))
    .map((e: Entity) => ({ id: e.id, kind: e.kind, x: e.x, y: e.y, hp: e.hp }));
  const wrecks: Wreck[] = s.wrecks.filter((w: Wreck) =>
    isVisibleNow(s, w.x, w.y),
  );
  return { cells, entities, wrecks };
}

// Same visibility rule as redact() above, applied per-event instead of to
// the final entity/wreck lists — an event whose position(s) are all
// currently out of sight is dropped rather than sent, same as an
// out-of-sight entity never showing up in `entities`. A move-type event
// (it has `toX`/`toY`) counts as visible if either end of the move is —
// something stepping out of sight is still worth seeing leave.
function redactEvents(
  s: RunState,
  events: WildernessEvent[],
): WildernessEvent[] {
  return events.filter((e) => {
    if (isVisibleNow(s, e.x, e.y)) return true;
    return "toX" in e && "toY" in e && isVisibleNow(s, e.toX, e.toY);
  });
}

export interface PublicRunView {
  runId: string;
  w: number;
  h: number;
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  energy: number;
  energyStart: number;
  chassis: Chassis;
  loot: LootDrop[];
  cells: PublicCell[];
  entities: PublicEntity[];
  wrecks: Wreck[];
  log: LogEntry[];
  status: RunStatus;
  step: number;
  cleared: boolean;
}

export function toPublicView(runId: string, s: RunState): PublicRunView {
  const { cells, entities, wrecks } = redact(s);
  return {
    runId,
    w: s.w,
    h: s.h,
    x: s.x,
    y: s.y,
    hp: s.hp,
    hpMax: s.hpMax,
    energy: s.energy,
    energyStart: s.energyStart,
    chassis: s.chassis,
    loot: s.loot,
    cells,
    entities,
    wrecks,
    log: s.log,
    status: s.status,
    step: s.step,
    cleared: s.cleared,
    weapons: [],
  };
}

export type ActiveActionResult =
  | { kind: "ok"; view: PublicRunView; events: WildernessEvent[]; err?: string }
  | { kind: "not_found" }
  | { kind: "conflict" };

export async function applyActiveAction(
  id: string,
  playerId: string,
  apply: (state: RunState) => {
    s: RunState;
    err?: string;
    events: WildernessEvent[];
  },
): Promise<ActiveActionResult> {
  const loaded = await loadActiveRun(id, playerId);
  if (!loaded) return { kind: "not_found" };
  const expectedStep = loaded.state.step;
  const r = apply(loaded.state);
  const saved = await saveActiveState(id, expectedStep, r.s);
  if (!saved) return { kind: "conflict" };
  return {
    kind: "ok",
    view: toPublicView(id, r.s),
    events: redactEvents(r.s, r.events),
    err: r.err,
  };
}

// Writes the run + a balance_transactions ledger row (scrap converts to
// credits at its flat sell price) + grants parts straight into
// player_inventory, atomically, then deletes the in_progress_runs row.
// `state.status` must already be terminal — this settles a run that has
// already ended one way or another, same contract as mining's settleRun().
export async function settleRun(
  row: RunRow,
  state: RunState,
): Promise<ScoreResult> {
  const result = score(state);
  const runId = randomUUID();

  const statements = [
    sql`
      insert into runs (id, player_id, game, seed, config, status, units, grade, net, move_log)
      values (
        ${runId}, ${row.player_id}, ${row.game}, ${state.seed},
        ${JSON.stringify({ loadout: row.loadout })},
        ${state.status}, ${result.kills}, 0, 0,
        ${JSON.stringify(state.log)}
      )
    `,
  ];

  if (result.scrap > 0) {
    statements.push(sql`
      insert into player_inventory (player_id, item_key, owned_quantity)
      values (${row.player_id}, 'lc_scrap', ${result.scrap})
      on conflict (player_id, item_key)
      do update set owned_quantity = player_inventory.owned_quantity + excluded.owned_quantity, updated_at = now()
    `);
  }

  const partTierSuffix: Record<number, string> = {
    1: "basic",
    2: "t2",
    3: "t3",
    4: "t4",
  };
  for (const part of result.parts) {
    const itemKey = `lc_${part.category}_${partTierSuffix[part.tier]}`;
    statements.push(sql`
      insert into player_inventory (player_id, item_key, owned_quantity)
      values (${row.player_id}, ${itemKey}, 1)
      on conflict (player_id, item_key)
      do update set owned_quantity = player_inventory.owned_quantity + 1, updated_at = now()
    `);
  }

  await sql.transaction(statements);
  await sql`delete from in_progress_runs where id = ${row.id}`;

  return result;
}

// Same abandoned-run safety net as mining's settleAbandonedRuns() — a run
// can go terminal (energy dry, chassis destroyed) without the client ever
// calling /settle; this catches those before a player gets a fresh field.
export async function settleAbandonedRuns(playerId: string): Promise<void> {
  const rows = await sql`
    select id, player_id, game, seed, phase, loadout, state
    from in_progress_runs
    where player_id = ${playerId} and game = ${GAME} and phase = 'active'
      and state->>'status' <> 'active'
  `;
  for (const row of rows as RunRow[]) {
    await settleRun(row, deserializeState(row.state));
  }
}

export async function assignNewParcel(
  playerId: string,
  seed: number,
): Promise<{ runId: string; balance: string }> {
  await settleAbandonedRuns(playerId);
  await sql`delete from in_progress_runs where player_id = ${playerId} and game = ${GAME} and phase = 'fitting'`;

  const [row] = await sql`
    insert into in_progress_runs (player_id, game, seed, phase)
    values (${playerId}, ${GAME}, ${seed}, 'fitting')
    returning id
  `;

  const [{ balance }] =
    await sql`select balance from players where id = ${playerId}`;
  return { runId: row.id, balance };
}
