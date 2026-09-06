import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { applyBatchAction } from "@/lib/refine-batch-store";
import { applyVent } from "@/lib/refine-engine";

// POST { amount } -> { state, err } — releases the given amount of
// pressure, clamped server-side to the equipped valve's ventMin/ventMax
// range (see applyVent() in lib/refine-engine.ts). The UI offers this as a
// row of preset buttons (valve min/max) rather than a slider.
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
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }

  const result = await applyBatchAction(id, player.id, (s) =>
    applyVent(s, amount),
  );
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  if (result.kind === "conflict") {
    return NextResponse.json({ error: "conflicting request, retry" }, { status: 409 });
  }
  return NextResponse.json({ state: result.state, err: result.err });
}
