import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { applyBatchAction } from "@/lib/refine-batch-store";
import { applySetHeaterRate } from "@/lib/refine-engine";

// POST { rate } -> { state, err } — sets the vat heater's standing
// heat/sec (see applySetHeaterRate() in lib/refine-engine.ts). Free,
// always available, like the fin power dial.
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
  const rate = Number(body.rate);
  if (!Number.isFinite(rate)) {
    return NextResponse.json({ error: "invalid rate" }, { status: 400 });
  }

  const result = await applyBatchAction(id, player.id, (s) =>
    applySetHeaterRate(s, rate),
  );
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  if (result.kind === "conflict") {
    return NextResponse.json({ error: "conflicting request, retry" }, { status: 409 });
  }
  return NextResponse.json({ state: result.state, err: result.err });
}
