import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import {
  assignNewParcel,
  loadActiveRun,
  toPublicView,
} from "@/lib/land-clearing-run-store";
import { sql } from "@/db/client";

const GAME = "land_clearing";

// POST -> the player's current in-progress run, resumed as-is if one
// exists (fitting or active); a fresh parcel is only generated when there
// truly isn't one yet. Mirrors POST /api/runs/current's resume-or-create
// contract for mining.
export async function POST() {
  const player = await currentPlayer({ touch: false });
  if (!player)
    return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const [row] = await sql`
    select id, phase from in_progress_runs
    where player_id = ${player.id} and game = ${GAME}
    order by created_at desc limit 1
  `;

  if (!row) {
    const seed = Math.floor(Math.random() * 9000) + 1000;
    const { runId, balance } = await assignNewParcel(player.id, seed);
    return NextResponse.json({ phase: "fitting", runId, balance });
  }

  if (row.phase === "fitting") {
    const [{ balance }] =
      await sql`select balance from players where id = ${player.id}`;
    return NextResponse.json({ phase: "fitting", runId: row.id, balance });
  }

  const active = await loadActiveRun(row.id, player.id);
  if (!active) {
    const seed = Math.floor(Math.random() * 9000) + 1000;
    const { runId, balance } = await assignNewParcel(player.id, seed);
    return NextResponse.json({ phase: "fitting", runId, balance });
  }

  console.log(active);
  const [{ balance }] =
    await sql`select balance from players where id = ${player.id}`;
  return NextResponse.json({
    phase: "active",
    runId: row.id,
    view: toPublicView(row.id, active.state),
    balance,
  });
}
