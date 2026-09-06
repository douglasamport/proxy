import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { startSizing } from "@/lib/refine-batch-store";

// POST {} -> { batchId, balance, oreOptions }
//
// Always opens a BRAND NEW sizing row, discarding any unlaunched bid — the
// explicit "start over" action (Refit, Play again), not what a plain page
// load calls. Mirrors POST /api/runs/field. No seed override here (mining's
// dev-only reseed control) — a refine batch's block draw order isn't
// something a player would ever want to hand-pick for testing purposes
// beyond what the seed itself already gives via replay.
export async function POST(_req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const seed = Math.floor(Math.random() * 9000) + 1000;
  const { batchId, balance, oreOptions } = await startSizing(
    player.id,
    seed,
  );
  return NextResponse.json({ batchId, balance, oreOptions });
}
