import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { applyBatchAction } from "@/lib/refine-batch-store";
import { applyDecantAll } from "@/lib/refine-engine";
import { hasDecanterAuto } from "@/lib/refine-inventory";

// POST {} -> { state, err } — banks everything currently affordable in
// ready ore in one action. Gated on owning the Auto-Decanter unlock
// (db/017_refine_precision_gear.sql); checked before applying, same order
// as the coolant route.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const owned = await hasDecanterAuto(player.id);
  if (!owned) {
    return NextResponse.json({ error: "auto-decanter not owned" }, { status: 400 });
  }

  const { id } = await params;
  const result = await applyBatchAction(id, player.id, applyDecantAll, "decant_all");
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  if (result.kind === "conflict") {
    return NextResponse.json({ error: "conflicting request, retry" }, { status: 409 });
  }
  return NextResponse.json({ state: result.state, err: result.err });
}
