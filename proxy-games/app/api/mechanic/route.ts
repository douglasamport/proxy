import { NextRequest, NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { getSite } from "@/lib/sites";
import { isUuid } from "@/lib/ids";
import {
  buyChassis,
  buyEquipment,
  buyEquipmentBay,
  expandChassis,
  sellEquipment,
} from "@/lib/mechanic";

// POST { action, siteId, ... } — everything the Mechanic site sells.
//   { action: "buy-chassis",   siteId, name }     -> { balance, proxyId }
//   { action: "expand",        siteId, proxyId }  -> { balance, slotTotal }
//   { action: "equipment-bay", siteId, proxyId }  -> { balance }
//   { action: "buy-item" | "sell-item", siteId, item_key, quantity } -> { balance }
//     (field equipment only: ore siphon, line scanner)
// `siteId` must be a Mechanic site (also what the ledger row records);
// expand / equipment-bay act on exactly the one chassis named by `proxyId`,
// which has to belong to the signed-in player's character.
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, siteId, proxyId } = body;

  if (!isUuid(siteId)) {
    return NextResponse.json({ error: "missing siteId" }, { status: 400 });
  }
  const site = await getSite(siteId);
  if (!site || site.activity_type !== "mechanic") {
    return NextResponse.json({ error: "unknown site" }, { status: 404 });
  }

  if (action === "buy-chassis") {
    const r = await buyChassis(player.id, siteId, body.name);
    if (r.kind === "invalid_name") {
      return NextResponse.json({ error: "invalid name" }, { status: 400 });
    }
    if (r.kind === "insufficient_funds") {
      return NextResponse.json({ error: "insufficient funds" }, { status: 402 });
    }
    if (r.kind === "not_found") {
      return NextResponse.json({ error: "not available" }, { status: 404 });
    }
    return NextResponse.json({ balance: r.balance, proxyId: r.proxyId });
  }

  if (action === "expand" || action === "equipment-bay") {
    if (!isUuid(proxyId)) {
      return NextResponse.json({ error: "missing proxyId" }, { status: 400 });
    }
    if (action === "expand") {
      const r = await expandChassis(player.id, siteId, proxyId);
      if (r.kind === "not_found") {
        return NextResponse.json({ error: "chassis not found" }, { status: 404 });
      }
      if (r.kind === "insufficient_funds") {
        return NextResponse.json({ error: "insufficient funds" }, { status: 402 });
      }
      return NextResponse.json({ balance: r.balance, slotTotal: r.slotTotal });
    }
    const r = await buyEquipmentBay(player.id, siteId, proxyId);
    if (r.kind === "not_found") {
      return NextResponse.json({ error: "chassis not found" }, { status: 404 });
    }
    if (r.kind === "already_owned") {
      return NextResponse.json({ error: "already installed" }, { status: 409 });
    }
    if (r.kind === "insufficient_funds") {
      return NextResponse.json({ error: "insufficient funds" }, { status: 402 });
    }
    return NextResponse.json({ balance: r.balance });
  }

  if (action === "buy-item" || action === "sell-item") {
    const { item_key: itemKey, quantity } = body;
    if (
      typeof itemKey !== "string" ||
      !itemKey ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > 1000
    ) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    const r =
      action === "buy-item"
        ? await buyEquipment(player.id, siteId, itemKey, quantity)
        : await sellEquipment(player.id, siteId, itemKey, quantity);
    if (r.kind === "not_found") {
      return NextResponse.json({ error: "item not found" }, { status: 404 });
    }
    if (r.kind === "insufficient_funds") {
      return NextResponse.json({ error: "insufficient funds" }, { status: 402 });
    }
    if (r.kind === "insufficient_owned") {
      return NextResponse.json({ error: "not enough to sell" }, { status: 409 });
    }
    return NextResponse.json({ balance: r.balance });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
