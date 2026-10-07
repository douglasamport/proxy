import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import {
  renameChassis,
  scrapChassis,
  setChassisAssignment,
} from "@/lib/mechanic";

// POST { action, proxyId, ... } — managing a chassis you already own
// (the /proxies page). Buying and upgrading happen at the Mechanic
// (POST /api/mechanic).
//   { action: "rename", proxyId, name }                    -> { ok }
//   { action: "assign", proxyId, activityType, assigned }  -> { ok }
//   { action: "scrap",  proxyId }                          -> { balance, credited }
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, proxyId } = body;
  if (!isUuid(proxyId)) {
    return NextResponse.json({ error: "missing proxyId" }, { status: 400 });
  }

  if (action === "rename") {
    const r = await renameChassis(player.id, proxyId, body.name);
    if (r === "invalid_name") {
      return NextResponse.json({ error: "invalid name" }, { status: 400 });
    }
    if (r === "not_found") {
      return NextResponse.json({ error: "chassis not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "assign") {
    if (typeof body.activityType !== "string" || typeof body.assigned !== "boolean") {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    const r = await setChassisAssignment(
      player.id,
      proxyId,
      body.activityType,
      body.assigned,
    );
    if (r === "invalid_activity") {
      return NextResponse.json({ error: "can't assign that activity yet" }, { status: 400 });
    }
    if (r === "not_found") {
      return NextResponse.json({ error: "chassis not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "scrap") {
    const r = await scrapChassis(player.id, proxyId);
    if (r.kind === "not_found") {
      return NextResponse.json({ error: "chassis not found" }, { status: 404 });
    }
    return NextResponse.json({ balance: r.balance, credited: r.credited });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
