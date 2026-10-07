import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/db/client";
import { currentPlayer } from "@/lib/auth";
import { startSizing, loadActiveBatch } from "@/lib/refine-batch-store";
import { loadOreOptions } from "@/lib/refine-inventory";
import { getOrCreateCharacter } from "@/lib/characters";
import { getEnergy } from "@/lib/energy";
import { getSite } from "@/lib/sites";

// POST { siteId } -> the player's current in-progress refine batch, resumed as-is
// if one exists (sizing or active) — a fresh sizing row is only opened when
// there truly isn't one yet. Mirrors POST /api/runs/current: this is what
// page load/navigation calls, never discarding an unlaunched bid or an
// active batch (see POST /api/refine/new for the explicit "new bid" path).
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { siteId } = body;

  if (typeof siteId !== "string" || !siteId) {
    return NextResponse.json({ error: "missing siteId" }, { status: 400 });
  }

  const site = await getSite(siteId);
  if (!site || site.activity_type !== "refining") {
    return NextResponse.json({ error: "Unknown site" }, { status: 404 });
  }

  const characterId = await getOrCreateCharacter(player.id, "Pilot");

  const [row] = await sql`
    select id, phase from in_progress_runs
    where player_id = ${player.id} and site_id = ${siteId}
    order by created_at desc limit 1
  `;

  if (!row) {
    const seed = Math.floor(Math.random() * 9000) + 1000;
    const [{ batchId, balance, oreOptions }, energy] = await Promise.all([
      startSizing(player.id, seed, siteId),
      getEnergy(characterId),
    ]);
    return NextResponse.json({
      phase: "fitting",
      batchId,
      balance,
      energy: energy.current,
      oreOptions,
    });
  }

  if (row.phase === "fitting") {
    const [[{ balance }], oreOptions, energy] = await Promise.all([
      sql`select balance from players where id = ${player.id}`,
      loadOreOptions(player.id),
      getEnergy(characterId),
    ]);
    return NextResponse.json({
      phase: "fitting",
      batchId: row.id,
      balance,
      energy: energy.current,
      oreOptions,
    });
  }

  const active = await loadActiveBatch(row.id, player.id);
  if (!active) {
    // Row vanished between the two reads (rare) — fall back to a fresh bid.
    const seed = Math.floor(Math.random() * 9000) + 1000;
    const [{ batchId, balance, oreOptions }, energy] = await Promise.all([
      startSizing(player.id, seed, siteId),
      getEnergy(characterId),
    ]);
    return NextResponse.json({
      phase: "fitting",
      batchId,
      balance,
      energy: energy.current,
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
