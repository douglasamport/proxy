import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { completeCharacterSetup } from "@/lib/characters";

export async function POST(req: Request) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 24) {
    return NextResponse.json(
      { error: "Name must be 2–24 characters" },
      { status: 400 },
    );
  }

  const created = await completeCharacterSetup(player.id, name);
  if (!created) {
    return NextResponse.json(
      { error: "Character already exists" },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
