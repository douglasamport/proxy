import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { applyBatchAction } from "@/lib/refine-batch-store";
import { startMelt } from "@/lib/refine-engine";

// POST { slotIndex } -> { state, err }
//
// Starts a hold-to-melt on the given offer slot. The client is responsible
// for polling/re-ticking while the hold is in progress (see POST
// /api/refine/[id]/tick) so the UI reflects melt completion without the
// player having to press anything else — melt is exclusive by design (see
// design doc §4.4), not by the client withholding other requests.
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
    startMelt(s, slotIndex),
  );
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  if (result.kind === "conflict") {
    return NextResponse.json({ error: "conflicting request, retry" }, { status: 409 });
  }
  return NextResponse.json({ state: result.state, err: result.err });
}
