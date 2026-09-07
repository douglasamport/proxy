import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { applyBatchAction } from "@/lib/refine-batch-store";
import { applyUseCoolant } from "@/lib/refine-engine";
import { loadCoolantCount, consumeCoolant } from "@/lib/refine-inventory";

// POST {} -> { state, err } — uses one owned Coolant Flush (db/016), if any,
// to instantly empty the cooler. Checked before applying (so a player with
// none gets a clean error rather than a state change that then can't be
// paid for), and only actually consumed after the batch action itself
// succeeds — same order as mining's ore-siphon/line-scanner routes.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const { id } = await params;

  const owned = await loadCoolantCount(player.id);
  if (owned <= 0) {
    return NextResponse.json({ error: "no coolant flush owned" }, { status: 400 });
  }

  const result = await applyBatchAction(id, player.id, applyUseCoolant, "coolant");
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  if (result.kind === "conflict") {
    return NextResponse.json({ error: "conflicting request, retry" }, { status: 409 });
  }
  if (!result.err) {
    await consumeCoolant(player.id);
  }

  return NextResponse.json({ state: result.state, err: result.err });
}
