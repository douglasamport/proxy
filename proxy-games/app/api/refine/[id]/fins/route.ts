import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { applyBatchAction } from "@/lib/refine-batch-store";
import { applySetFinPower } from "@/lib/refine-engine";

// POST { power } (0-100) -> { state, err } — raise/lower the cooling fins.
// Free, unlike the other vat/cooler actions — see applySetFinPower()'s
// comment in lib/refine-engine.ts.
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
  const power = Number(body.power);
  if (!Number.isFinite(power)) {
    return NextResponse.json({ error: "invalid power" }, { status: 400 });
  }

  const result = await applyBatchAction(id, player.id, (s) =>
    applySetFinPower(s, power / 100),
  );
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  if (result.kind === "conflict") {
    return NextResponse.json({ error: "conflicting request, retry" }, { status: 409 });
  }
  return NextResponse.json({ state: result.state, err: result.err });
}
