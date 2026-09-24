// app/api/dev/ore-type/route.ts — dev-only debug route, see the "how do I
// test a raw DB function in the browser" conversation. loadOreTypes() was
// renamed to loadOreData() (lib/mining-inventory.ts); this route just
// hadn't caught up.
import { NextResponse } from "next/server";
import { loadOreData } from "@/lib/mining-inventory";

export async function GET() {
  const rows = await loadOreData();
  return NextResponse.json(rows);
}
