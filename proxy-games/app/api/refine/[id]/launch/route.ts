import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { launchBatch } from "@/lib/refine-batch-store";
import { computeRefineRig } from "@/lib/refine-inventory";
import { ORE_TYPES } from "@/lib/mining-engine";
import type { OreTypeKey } from "@/lib/mining-engine";

// POST { bidUnits, oreType } -> { state }
//
// The rig isn't read from the request — it's computed server-side from
// whatever furnace/vat/cooler is actually equipped (see computeRefineRig()
// in lib/refine-inventory.ts), same reasoning as mining's chassis: a
// client claiming a build it doesn't own can't happen. bidUnits is the
// batch-size bid (§6.3) — validated against actual owned ore inside
// launchBatch(), not here. oreType picks which of the 13 minerals this
// batch refines; only its shape (a real OreTypeKey) is checked here —
// whether the player has actually unlocked and owns any is launchBatch()'s
// job, same trust boundary as the bid amount.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const bidUnits = Number(body.bidUnits);
  const oreType = body.oreType;
  if (!Number.isFinite(bidUnits) || bidUnits <= 0) {
    return NextResponse.json({ error: "invalid bid" }, { status: 400 });
  }
  if (typeof oreType !== "string" || !(oreType in ORE_TYPES)) {
    return NextResponse.json({ error: "invalid ore type" }, { status: 400 });
  }

  const rig = await computeRefineRig(player.id);
  const result = await launchBatch(
    id,
    player.id,
    Math.floor(bidUnits),
    oreType as OreTypeKey,
    rig,
  );

  if (result.kind === "not_found") {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  if (result.kind === "no_furnace") {
    return NextResponse.json({ error: "no furnace equipped" }, { status: 400 });
  }
  if (result.kind === "insufficient_ore") {
    return NextResponse.json({ error: "not enough ore" }, { status: 402 });
  }

  return NextResponse.json({ state: result.state });
}
