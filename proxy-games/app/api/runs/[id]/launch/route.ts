import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/db/client";
import { currentPlayer } from "@/lib/auth";
import { loadFittingRun, toPublicView } from "@/lib/mining-run-store";
import {
  computeChassis,
  loadoutSnapshot,
  loadUnlockedOreTypes,
  loadOreData,
} from "@/lib/mining-inventory";
import { getOrCreateCharacter } from "@/lib/characters";
import { refundEnergy, spendEnergy } from "@/lib/energy";
import { CFG, applySurvey, createRun } from "@/lib/mining-engine";

// POST { claim } -> the initial PublicRunView for the run.
//
// No `alloc` in the request anymore — chassis stats are computed
// server-side from whatever's actually equipped in player_inventory (see
// lib/mining-inventory.ts). A client claiming a build it doesn't own isn't
// a thing that can happen now; the only way to change your chassis is
// POST /api/inventory/equip, which validates ownership itself. Survey
// still isn't read from the body either, same reasoning — see the equip
// route's sibling, app/api/runs/[id]/survey/route.ts.
//
// Claim size is paid for in persistent character energy now, not credits
// (see lib/energy.ts) — spent here, before the run is created, so a run
// never exists without its energy already having been paid for. Nothing
// refunds it: an aborted/stranded/wrecked run doesn't get its energy back,
// same as it never got its old money cost back either.
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

  const claim = body.claim;
  if (!CFG.CLAIM_OPTIONS.includes(claim)) {
    return NextResponse.json({ error: "invalid claim size" }, { status: 400 });
  }

  const row = await loadFittingRun(id, player.id);
  if (!row) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  const characterId = await getOrCreateCharacter(player.id, "Pilot");
  const spend = await spendEnergy(characterId, claim);
  if (!spend.ok) {
    return NextResponse.json(
      { error: "not enough energy", available: spend.available },
      { status: 402 },
    );
  }

  const [chassis, loadout, unlockedOreTypes, oreData] = await Promise.all([
    computeChassis(player.id),
    loadoutSnapshot(player.id),
    loadUnlockedOreTypes(player.id),
    loadOreData(),
  ]);
  const state = applySurvey(
    createRun(row.seed, chassis, oreData, claim, unlockedOreTypes),
    row.survey,
  );

  const [saved] = await sql`
    update in_progress_runs
    set phase = 'active', loadout = ${JSON.stringify(loadout)}::jsonb, claim = ${claim},
        state = ${JSON.stringify({ ...state, seen: Array.from(state.seen) })}::jsonb, updated_at = now()
    where id = ${id} and player_id = ${player.id} and phase = 'fitting'
    returning id
  `;
  if (!saved) {
    // Lost a race against a concurrent launch (double-click, two tabs) —
    // the energy already spent above belongs to nothing, since this
    // request's run never actually activated. Refund it rather than
    // charging twice for one launched run.
    await refundEnergy(characterId, claim);
    return NextResponse.json(
      { error: "run already launched" },
      { status: 409 },
    );
  }

  return NextResponse.json(toPublicView(id, state));
}
