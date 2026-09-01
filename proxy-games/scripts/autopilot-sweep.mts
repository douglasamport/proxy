// Stage 0 (build-spec-ore-progression.md): a statistical sweep of the
// autopilot baseline across many seeds. Every later stage's acceptance
// criteria ("<10% losing runs", "statistically unchanged") checks against
// this — a single seed can look fine while the aggregate is broken (the
// cherry-picking and oscillation bugs referenced in the spec's Context
// section were both invisible in one-off runs).
//
// Pure — imports only the engine, no DB, no server. Run directly with Node
// (no build step, no ts-node): `node scripts/autopilot-sweep.mts [count] [claim]`
//
//   node scripts/autopilot-sweep.mts          # 300 seeds, 35E claim
//   node scripts/autopilot-sweep.mts 1000     # 1000 seeds, 35E claim
//   node scripts/autopilot-sweep.mts 300 50   # 300 seeds, 50E claim

import { runAI, score, chassisFromEffects } from '../lib/mining-engine.ts';
import type { Chassis, StatKey } from '../lib/mining-engine.ts';

// Per-unit effects of each basic item, copied from item_catalog (as of this
// writing) rather than read from the DB — this script stays dependency-free
// on purpose. If the catalog's basic-item effects change, update here too.
const BASIC_EFFECTS: Record<string, Partial<Record<StatKey, number>>> = {
  fuel: { fuelCap: 24 },
  cargo: { hold: 5 },
  armour: { sinkCap: 12 },
  drive: { speed: 0.20 },
  steer: { movement: 0.22 },
  sensor: { sensorRange: 1.9, sensorBlur: -0.38, pingFuel: -0.35 },
  analyser: { analyser: -0.8 },
};

// Every real chassis gets 1 free drive/steer/armour/cargo on top of
// whatever's bought — see BASELINE_* in lib/mining-inventory.ts. Mirrored
// here (not imported — that logic lives behind a DB call) so this script's
// numbers match what a player with this purchase history would actually get.
const FREE_BASELINE: Record<string, number> = { drive: 1, steer: 1, armour: 1, cargo: 1 };

function buildChassis(bought: Record<string, number>): Chassis {
  const effects: Partial<Record<StatKey, number>> = {};
  const total = { ...bought };
  for (const [k, qty] of Object.entries(FREE_BASELINE)) total[k] = (total[k] ?? 0) + qty;
  for (const [k, qty] of Object.entries(total)) {
    const per = BASIC_EFFECTS[k];
    if (!per || !qty) continue;
    for (const key of Object.keys(per) as StatKey[]) {
      effects[key] = (effects[key] ?? 0) + (per[key] ?? 0) * qty;
    }
  }
  return chassisFromEffects(effects);
}

// Two named builds, per the 2026-09-01 calibration discussion:
// PLAYER_BASELINE is a rounded-out "someone actually flying this" rig.
// AUTOPILOT is deliberately lean on steer/armour/sensor — sensors don't
// help unattended play and the design direction favors fuel/drive
// efficiency — but not on cargo: the first cut (4 drive, 6 fuel, no cargo)
// measured catastrophically (77% losing runs), because hold stuck at the
// free-baseline 5 forced far more round trips than the extra fuel/drive
// could pay for. Revised: one fuel and one drive moved to cargo instead.
const BUILDS: Record<string, Record<string, number>> = {
  'Player baseline (2 steer, 3 drive, 3 cargo, 5 fuel, 1 armour)': { steer: 2, drive: 3, cargo: 3, fuel: 5, armour: 1 },
  'Autopilot (3 drive, 5 fuel, 2 cargo)': { drive: 3, fuel: 5, cargo: 2 },
};

const N = Number(process.argv[2]) || 300;
const CLAIM = Number(process.argv[3]) || 35;

function sweep(chassis: Chassis, n: number, claim: number) {
  let losses = 0;
  let gradeSum = 0, gradeCount = 0;
  let claimSpentSum = 0;
  let netSum = 0, netMin = Infinity, netMax = -Infinity;
  let unitsSum = 0;
  const statusCounts: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    const seed = 100000 + i; // sequential, deterministic — reproducible across runs for before/after comparison
    const state = runAI(seed, chassis, claim);
    const r = score(state);

    if (r.net < 0) losses++;
    if (r.units > 0) { gradeSum += r.grade; gradeCount++; }
    claimSpentSum += r.claimSpent;
    netSum += r.net;
    netMin = Math.min(netMin, r.net);
    netMax = Math.max(netMax, r.net);
    unitsSum += r.units;
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }

  console.log(`Losing-run rate      ${((losses / n) * 100).toFixed(1)}%  (target <10%)`);
  console.log(`Average grade        ${gradeCount ? (gradeSum / gradeCount).toFixed(2) : 'n/a'}`);
  console.log(`Claim fill rate      ${((claimSpentSum / n) * 100).toFixed(1)}%  (energy spent / claimed)`);
  console.log(`Average units banked ${(unitsSum / n).toFixed(1)}`);
  console.log(`Average net          ${(netSum / n).toFixed(1)}`);
  console.log(`Net range            ${netMin.toFixed(0)} .. ${netMax.toFixed(0)}`);
  console.log(`Status breakdown     ${Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
}

for (const [label, bought] of Object.entries(BUILDS)) {
  const chassis = buildChassis(bought);
  console.log(`\n${label} — ${N} seeds, ${CLAIM}E claim`);
  console.log(`  fuelCap ${chassis.fuelCap} · hold ${chassis.hold} · sink ${chassis.sinkCap} · speed ${chassis.speed.toFixed(2)} · movement ${chassis.movement.toFixed(2)}`);
  console.log('-'.repeat(56));
  sweep(chassis, N, CLAIM);
}
