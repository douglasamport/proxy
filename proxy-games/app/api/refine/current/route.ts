import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/db/client";
import { currentPlayer } from "@/lib/auth";
import { startSizing, loadActiveBatch } from "@/lib/refine-batch-store";
import { loadOreOptions, GAME } from "@/lib/refine-inventory";

// POST {} -> the player's current in-progress refine batch, resumed as-is
// if one exists (sizing or active) — a fresh sizing row is only opened when
// there truly isn't one yet. Mirrors POST /api/runs/current: this is what
// page load/navigation calls, never discarding an unlaunched bid or an
// active batch (see POST /api/refine/new for the explicit "new bid" path).
export async function POST(_req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const [row] = await sql`
    select id, phase from in_progress_runs
    where player_id = ${player.id} and game = ${GAME}
    order by created_at desc limit 1
  `;

  if (!row) {
    const seed = Math.floor(Math.random() * 9000) + 1000;
    const { batchId, balance, oreOptions } = await startSizing(
      player.id,
      seed,
    );
    return NextResponse.json({
      phase: "fitting",
      batchId,
      balance,
      oreOptions,
    });
  }

  if (row.phase === "fitting") {
    const [[{ balance }], oreOptions] = await Promise.all([
      sql`select balance from players where id = ${player.id}`,
      loadOreOptions(player.id),
    ]);
    return NextResponse.json({
      phase: "fitting",
      batchId: row.id,
      balance,
      oreOptions,
    });
  }

  const active = await loadActiveBatch(row.id, player.id);
  if (!active) {
    // Row vanished between the two reads (rare) — fall back to a fresh bid.
    const seed = Math.floor(Math.random() * 9000) + 1000;
    const { batchId, balance, oreOptions } = await startSizing(
      player.id,
      seed,
    );
    return NextResponse.json({
      phase: "fitting",
      batchId,
      balance,
      oreOptions,
    });
  }

  const [{ balance }] =
    await sql`select balance from players where id = ${player.id}`;
  return NextResponse.json({
    phase: "active",
    batchId: row.id,
    state: active.state,
    balance,
  });
}
