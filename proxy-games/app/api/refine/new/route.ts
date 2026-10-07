import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { startSizing } from "@/lib/refine-batch-store";
import { getSite } from "@/lib/sites";

// POST { siteId } -> { batchId, balance, oreOptions }
//
// Always opens a BRAND NEW sizing row, discarding any unlaunched bid — the
// explicit "start over" action (Refit, Play again), not what a plain page
// load calls. Mirrors POST /api/runs/field. No seed override here (mining's
// dev-only reseed control) — a refine batch's block draw order isn't
// something a player would ever want to hand-pick for testing purposes
// beyond what the seed itself already gives via replay.
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

  const seed = Math.floor(Math.random() * 9000) + 1000;
  const { batchId, balance, oreOptions } = await startSizing(
    player.id,
    seed,
    siteId,
  );
  return NextResponse.json({ batchId, balance, oreOptions });
}
