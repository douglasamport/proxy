// Server-authoritative live batch state for the Refinery minigame — the
// refine equivalent of lib/mining-run-store.ts. Reuses the same two tables
// mining's runs live in (in_progress_runs / runs): both are already scoped
// by a bare `game` text column with no mining-specific columns required, so
// a second game costs zero migrations here, same as the design doc's §10
// claim. `claim` (mining's energy bid) is reused as the ore-unit batch bid
// (§6.3) — same "commit an amount before you can see the whole picture"
// role, different currency. `loadout` holds the RefineRig snapshot at
// launch instead of mining's item-list shape — the column is untyped jsonb,
// and this file is the only reader/writer for game='refine' rows in it.
import { randomUUID } from "crypto";
import { sql } from "@/db/client";
import {
  createBatch,
  tick,
  applyShutdown,
  meanDecantQuality,
  appendLog,
} from "./refine-engine";
import type { BatchState, RefineRig, BatchStatus } from "./refine-engine";
import type { OreTypeKey } from "./mining-engine";
import {
  GAME,
  oreItemKey,
  refinedOutputItemKey,
  loadAvailableOre,
  loadOreOptions,
  debitOre,
} from "./refine-inventory";
import type { OreOption } from "./refine-inventory";

export interface BatchRow {
  id: string;
  player_id: string;
  game: string;
  seed: number;
  phase: "fitting" | "active";
  loadout: RefineRig | null;
  claim: number | null; // bidUnits
  state: unknown;
  updated_at: string;
}

function deserializeState(raw: unknown): BatchState {
  return raw as BatchState;
}

export async function loadFittingBatch(
  playerId: string,
): Promise<BatchRow | null> {
  const [row] = await sql`
    select id, player_id, game, seed, phase, loadout, claim, state, updated_at
    from in_progress_runs
    where player_id = ${playerId} and game = ${GAME} and phase = 'fitting'
  `;
  return (row as BatchRow) ?? null;
}

export async function loadActiveBatch(
  id: string,
  playerId: string,
): Promise<{ row: BatchRow; state: BatchState } | null> {
  const [row] = await sql`
    select id, player_id, game, seed, phase, loadout, claim, state, updated_at
    from in_progress_runs
    where id = ${id} and player_id = ${playerId} and game = ${GAME} and phase = 'active'
  `;
  if (!row) return null;
  return {
    row: row as BatchRow,
    state: deserializeState((row as BatchRow).state),
  };
}

// Optimistic concurrency on the batch's internal clock, same role as
// mining's `step` counter — a losing concurrent write touches 0 rows
// instead of clobbering the winner's state.
async function saveActiveState(
  id: string,
  expectedClock: number,
  next: BatchState,
): Promise<boolean> {
  const [row] = await sql`
    update in_progress_runs
    set state = ${JSON.stringify(next)}::jsonb, updated_at = now()
    where id = ${id} and ((state->>'clock')::float) = ${expectedClock}
    returning id
  `;
  return !!row;
}

// Settles any abandoned active batch (ended without the client calling
// end/settle — same non-active-status sweep mining does), clears any
// unlaunched fitting row, and opens a fresh sizing row. Ore is NOT debited
// here — that happens at launchBatch(), once the player has actually
// chosen a bid.
export async function startSizing(
  playerId: string,
  seed: number,
): Promise<{ batchId: string; balance: string; oreOptions: OreOption[] }> {
  await settleAbandonedBatches(playerId);
  await sql`delete from in_progress_runs where player_id = ${playerId} and game = ${GAME} and phase = 'fitting'`;

  const [row] = await sql`
    insert into in_progress_runs (player_id, game, seed, phase)
    values (${playerId}, ${GAME}, ${seed}, 'fitting')
    returning id
  `;
  const [{ balance }] =
    await sql`select balance from players where id = ${playerId}`;
  const oreOptions = await loadOreOptions(playerId);
  return { batchId: row.id, balance, oreOptions };
}

export type LaunchResult =
  | { kind: "ok"; state: BatchState }
  | { kind: "not_found" }
  | { kind: "insufficient_ore" }
  | { kind: "no_furnace" };

// Commits the bid: debits ore up front (same "spend before you see the
// field" shape as mining's claim cost), snapshots the rig, and flips the
// row to active. If bidUnits turns out to be unplayable (no furnace
// equipped), nothing is charged — the furnace check runs before the ore
// debit. oreType is fixed for the whole batch — see BatchState's comment.
export async function launchBatch(
  batchRowId: string,
  playerId: string,
  bidUnits: number,
  oreType: OreTypeKey,
  rig: RefineRig,
): Promise<LaunchResult> {
  const fitting = await loadFittingBatch(playerId);
  if (!fitting || fitting.id !== batchRowId) return { kind: "not_found" };
  if (rig.meltSpeedMult <= 0) return { kind: "no_furnace" };

  const available = await loadAvailableOre(playerId, oreType);
  if (!Number.isFinite(bidUnits) || bidUnits <= 0 || bidUnits > available) {
    return { kind: "insufficient_ore" };
  }

  await debitOre(playerId, oreType, bidUnits);
  const state = createBatch(fitting.seed, rig, bidUnits, oreType);

  await sql`
    update in_progress_runs
    set phase = 'active', claim = ${bidUnits}, loadout = ${JSON.stringify(rig)}::jsonb,
        state = ${JSON.stringify(state)}::jsonb, updated_at = now()
    where id = ${batchRowId} and player_id = ${playerId}
  `;

  return { kind: "ok", state };
}

export type ActiveActionResult =
  | { kind: "ok"; state: BatchState; err?: string }
  | { kind: "not_found" }
  | { kind: "conflict" };

// Loads the row, advances real elapsed time (melt completion, separation,
// pressure drift, forced vent, overheat — everything that happens whether
// or not the player does anything) using wall-clock time since the row was
// last saved, THEN applies the player's discrete action on top of that
// freshly-ticked state. Shared by every /api/refine/[id]/* action route.
//
// `action`, when given, is recorded into the batch's log (see
// lib/refine-engine.ts's LogEntry) as this call's audit-trail entry — the
// route's own descriptive label (e.g. "vent amount=45"), logged whether or
// not the action actually succeeded, since a rejected click ("not enough
// action charge") is exactly the kind of thing worth seeing when a
// playtester reports a batch behaving oddly. Omitted for a plain poll
// (pollBatch below) — logging every 400ms tick would drown out the actual
// player actions in the same log.
export async function applyBatchAction(
  id: string,
  playerId: string,
  apply: (state: BatchState) => { s: BatchState; err?: string },
  action?: string,
): Promise<ActiveActionResult> {
  const loaded = await loadActiveBatch(id, playerId);
  if (!loaded) return { kind: "not_found" };

  const expectedClock = loaded.state.clock;
  const dtMs = Math.max(0, Date.now() - new Date(loaded.row.updated_at).getTime());
  const ticked = tick(loaded.state, dtMs);
  const r = apply(ticked);
  if (action) appendLog(r.s, action, r.err);

  const saved = await saveActiveState(id, expectedClock, r.s);
  if (!saved) return { kind: "conflict" };
  return { kind: "ok", state: r.s, err: r.err };
}

// Advances time only — no player action — for a plain poll (the client
// re-fetching current state without pressing anything).
export async function pollBatch(
  id: string,
  playerId: string,
): Promise<ActiveActionResult> {
  return applyBatchAction(id, playerId, (s) => ({ s }));
}

export async function endActiveBatch(
  id: string,
  playerId: string,
): Promise<ActiveActionResult> {
  return applyBatchAction(
    id,
    playerId,
    (s) => {
      if (s.status !== "active") return { s }; // already terminal (overheat caught by an earlier tick)
      return applyShutdown(s);
    },
    "shutdown",
  );
}

// Writes the permanent `runs` row, returns unmelted ore on a deliberate
// shutdown (never on overheat — §6.4's two-exits asymmetry), credits
// whatever was actually banked, and deletes the in_progress_runs row.
// `state.status` must already be terminal.
export async function settleBatch(
  row: BatchRow,
  state: BatchState,
): Promise<{
  units: number;
  meanQuality: number;
  status: BatchStatus;
  orePerCathodeUnit: number | null;
}> {
  const meanQuality = meanDecantQuality(state);
  const outputItemKey = refinedOutputItemKey(state.oreType);

  const [output] = await sql`
    select sell_value from item_catalog where item_key = ${outputItemKey}
  `;
  const netValue = state.bankedUnits * Number(output?.sell_value ?? 0);

  // Ore accounting, for tuning telemetry (§6.7) — not the same number as
  // decantRatio(meanQuality), which only reflects ore that actually made
  // it through a decant. oreConsumed is everything that left the bid pool
  // (bid minus whatever's returned/destroyed unmelted); oreLoss is
  // melted-but-never-decanted material still sitting in the vat at the
  // moment the batch ended — lost either way per §6.4, whether that's from
  // a forced vent, or just never getting around to decanting it. The gap
  // between orePerCathodeUnit and decantRatio(meanQuality) is exactly how
  // much melted ore never reached a cathode at all.
  const oreConsumed = state.bidUnits - state.oreRemaining;
  const oreLoss = state.tankOre + state.tankSlag + state.readyOre;
  const orePerCathodeUnit =
    state.bankedUnits > 0 ? oreConsumed / state.bankedUnits : null;

  const runId = randomUUID();
  const statements = [
    sql`
      insert into runs (id, player_id, game, seed, config, status, units, grade, net, move_log)
      values (
        ${runId}, ${row.player_id}, ${row.game}, ${state.seed},
        ${JSON.stringify({ rig: row.loadout, bidUnits: state.bidUnits, oreType: state.oreType })},
        ${state.status}, ${state.bankedUnits}, ${meanQuality}, ${netValue},
        ${JSON.stringify({
          events: state.log,
          stats: { oreConsumed, oreLoss, orePerCathodeUnit },
        })}
      )
    `,
  ];

  if (state.status === "shutdown" && state.oreRemaining > 0) {
    statements.push(sql`
      insert into player_inventory (player_id, item_key, owned_quantity)
      values (${row.player_id}, ${oreItemKey(state.oreType)}, ${Math.floor(state.oreRemaining)})
      on conflict (player_id, item_key)
      do update set owned_quantity = player_inventory.owned_quantity + excluded.owned_quantity, updated_at = now()
    `);
  }
  if (state.bankedUnits > 0) {
    statements.push(sql`
      insert into player_inventory (player_id, item_key, owned_quantity)
      values (${row.player_id}, ${outputItemKey}, ${state.bankedUnits})
      on conflict (player_id, item_key)
      do update set owned_quantity = player_inventory.owned_quantity + excluded.owned_quantity, updated_at = now()
    `);
  }

  await sql.transaction(statements);
  await sql`delete from in_progress_runs where id = ${row.id}`;

  return {
    units: state.bankedUnits,
    meanQuality,
    status: state.status,
    orePerCathodeUnit,
  };
}

// Same non-active-status sweep as mining's settleAbandonedRuns() — a batch
// that hit overheat/shutdown without the client calling /end shouldn't be
// walkable-away-from indefinitely (see startSizing() above, which calls
// this before opening a new one).
export async function settleAbandonedBatches(playerId: string): Promise<void> {
  const rows = await sql`
    select id, player_id, game, seed, phase, loadout, claim, state, updated_at
    from in_progress_runs
    where player_id = ${playerId} and game = ${GAME} and phase = 'active'
      and state->>'status' <> 'active'
  `;
  for (const row of rows as BatchRow[]) {
    await settleBatch(row, deserializeState(row.state));
  }
}
