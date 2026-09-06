import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import {
  endActiveBatch,
  loadActiveBatch,
  settleBatch,
} from "@/lib/refine-batch-store";

// POST {} -> { state, summary? }
//
// The deliberate shutdown (§6.4) or the resolution of an overheat/forced
// state that a prior tick already reached. Unlike mining's two-step
// end-then-settle (which offers a credits-vs-ore choice), a refine batch
// always settles the same way — output banks as inventory, unmelted ore
// returns only on a deliberate shutdown — so this route settles
// immediately rather than waiting on a second request. `summary` is only
// present once the batch actually ended.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const result = await endActiveBatch(id, player.id);
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  if (result.kind === "conflict") {
    return NextResponse.json({ error: "conflicting request, retry" }, { status: 409 });
  }

  if (result.state.status === "active") {
    return NextResponse.json({ state: result.state, err: result.err });
  }

  const loaded = await loadActiveBatch(id, player.id);
  if (!loaded) {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  const summary = await settleBatch(loaded.row, loaded.state);

  return NextResponse.json({ state: result.state, summary });
}
