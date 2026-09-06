import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { pollBatch } from "@/lib/refine-batch-store";

// POST {} -> { state, err }
//
// Advances real elapsed time with no player action attached — everything
// that happens whether or not the player presses anything (melt
// completion, separation, pressure drift, forced vent, overheat). The
// client polls this while idle/holding a melt so the UI reflects those
// without requiring a click to trigger them.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const result = await pollBatch(id, player.id);
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  if (result.kind === "conflict") {
    return NextResponse.json({ error: "conflicting request, retry" }, { status: 409 });
  }
  return NextResponse.json({ state: result.state, err: result.err });
}
