import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { setActivePart, PART_CATEGORIES } from "@/lib/refine-inventory";
import type { PartCategory } from "@/lib/refine-inventory";

// POST { category, item_key } -> { ok: true } | error
//
// Activates one owned furnace/vat/cooler and deactivates every other owned
// item in that same category — see setActivePart() in
// lib/refine-inventory.ts for why this is a dedicated primitive rather
// than the shared /api/inventory/equip (mining's stacking multi-slot
// model doesn't apply here: a refine rig has exactly one active part per
// category, not "up to N equipped").
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { category, item_key: itemKey } = body;

  if (
    typeof category !== "string" ||
    !PART_CATEGORIES.includes(category as PartCategory) ||
    typeof itemKey !== "string" ||
    !itemKey
  ) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const result = await setActivePart(player.id, category as PartCategory, itemKey);
  if (result === "not_owned") {
    return NextResponse.json({ error: "not owned" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
