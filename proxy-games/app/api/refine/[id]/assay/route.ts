import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { applyBatchAction } from "@/lib/refine-batch-store";
import { startAssay } from "@/lib/refine-engine";

// POST { slotIndex } -> { state, err }
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
  const slotIndex = Number(body.slotIndex);
  if (![0, 1, 2].includes(slotIndex)) {
    return NextResponse.json({ error: "invalid slot" }, { status: 400 });
  }

  const result = await applyBatchAction(id, player.id, (s) =>
    startAssay(s, slotIndex),
  );
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  if (result.kind === "conflict") {
    return NextResponse.json({ error: "conflicting request, retry" }, { status: 409 });
  }
  return NextResponse.json({ state: result.state, err: result.err });
}
