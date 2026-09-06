// Pure engine for the Refinery minigame (Refinery v1 — see
// app/design_docs/minigame-v2-the-refinery.md). No DOM, no server, no
// wall-clock reads other than what's passed in — same portability goal as
// lib/mining-engine.ts. All functions take a BatchState and return a new
// one; nothing here touches the DB.
//
// Block grades/slag/melt-time numbers come straight from the design doc's
// §4.1 table. Several knobs below (heat per ore unit, cooler capacity,
// pressure coupling, separation rate) are marked as design-doc "open
// parameters" — §4.12 lists them explicitly as unresolved — so these are
// deliberate placeholders to be tuned once real batches are logged, not
// settled values.
//
// Refines any of mining's 13 minerals, not just copper — see TierTuning
// below for what actually varies by ore. The block-draw mechanics
// (grades/slag/melt-time) are the same for every mineral; only the
// tolerance windows and decant-ratio range tighten/widen by tier, which is
// what makes a rare-earth batch a harder, higher-stakes version of the
// same game rather than a reskin.
import { ORE_TYPES } from "./mining-engine";
import type { OreTypeKey } from "./mining-engine";

export type BlockGrade = 1 | 2 | 8 | 20;
export type BatchStatus = "sizing" | "active" | "shutdown" | "overheat";

// Matches the effect keys introduced in db/015/016/017's catalog rows.
export type StatKey =
  | "meltSpeedMult"
  | "tankCapacity"
  | "sinkRate"
  | "heaterMin"
  | "heaterMax"
  | "dissipationRate"
  | "ventMin"
  | "ventMax";

// Six equippable part categories, all the same "pick one active item per
// category" model (see setActivePart() in lib/refine-inventory.ts), not
// mining's stacking multi-slot equip. heater/radiator/valve were added
// alongside furnace/vat/cooler to give the tier-2+ sustainability problem
// (heat has to ride near its ceiling to feed pressure, with no cheap way
// back down) actual equipment answers instead of just harder numbers:
// heater lets you set a lower standing burn than the old fixed floor,
// radiator is the sink's ambient dissipation rate — previously a flat
// constant no upgrade touched at all — and valve replaces the flat vent
// bleed with a tunable range for holding a narrow pressure band. Lives
// here (not in lib/refine-inventory.ts) specifically so client components
// can import it without pulling in the DB client — see the same reasoning
// on EXPANSION_KEY/EQUIPMENT_SLOT_KEY in components/game-shell/CatalogScreen.tsx.
export const PART_CATEGORIES = [
  "furnace",
  "vat",
  "cooler",
  "heater",
  "radiator",
  "valve",
] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];

export interface RefineRig {
  meltSpeedMult: number;
  tankCapacity: number;
  sinkRate: number;
  heaterMin: number;
  heaterMax: number;
  dissipationRate: number;
  ventMin: number;
  ventMax: number;
}

// Sums equipped part effects into a rig — same shape as
// chassisFromEffects() in lib/mining-engine.ts. meltSpeedMult/tankCapacity/
// sinkRate fall back to 0 (a rig with meltSpeedMult 0 genuinely cannot
// melt — see meltDurationMs below — same divide-by-zero-avoidance mining's
// chassis has for an unequipped drive), which is safe because
// furnace/vat/cooler have always shipped in the starter kit.
//
// heaterMin/Max, dissipationRate, and ventMin/Max fall back to today's old
// hardcoded constants instead of 0 — these three categories shipped after
// furnace/vat/cooler, so an existing player who hasn't bought one yet (or
// simply hasn't had the one-time backfill run — see db/017) must still get
// exactly the old fixed behavior, not a broken 0-heat/0-dissipation/
// 0-vent rig. Owning a real heater/radiator/valve overrides these, it
// never adds on top of them.
export function rigFromEffects(
  effects: Partial<Record<StatKey, number>>,
): RefineRig {
  return {
    meltSpeedMult: effects.meltSpeedMult ?? 0,
    tankCapacity: effects.tankCapacity ?? 0,
    sinkRate: effects.sinkRate ?? 0,
    heaterMin: effects.heaterMin ?? 5,
    heaterMax: effects.heaterMax ?? 25,
    dissipationRate: effects.dissipationRate ?? 2,
    ventMin: effects.ventMin ?? 45,
    ventMax: effects.ventMax ?? 45,
  };
}

export interface Block {
  id: number;
  grade: BlockGrade;
  oreUnits: number; // always == grade — see db/015's comment on the ratio table
  slagUnits: number; // rolled within CFG.SLAG_RANGE[grade] at draw time
  revealed: boolean; // assay flips this true; melting a block works either way
  assayStartedAt: number | null; // batch-clock ms assay began, null if not assaying
}

export interface OfferSlot {
  block: Block | null;
  refillReadyAt: number | null; // batch-clock ms a new block appears; null if occupied
}

export interface MeltState {
  block: Block;
  slotIndex: number;
  startedAt: number; // batch-clock ms
  durationMs: number; // full melt time for this block at the rig active when melt started
}

export interface BatchState {
  seed: number;
  rig: RefineRig;
  oreType: OreTypeKey; // which mineral this batch is refining — set at launch, fixed for the batch
  bidUnits: number; // total ore committed at sizing (the "bid", §6.3)
  oreRemaining: number; // undrawn ore left in the bid pool
  offer: [OfferSlot, OfferSlot, OfferSlot];
  nextBlockId: number;

  melting: MeltState | null;

  tankOre: number; // raw melted ore, not yet separated
  tankSlag: number;
  readyOre: number; // separated, decantable — fractional carry-over allowed
  heat: number;
  pressure: number;
  dumping: boolean; // cooler dump toggle
  finPower: number; // 0..1, player-adjustable multiplier on sink rate (§4.11)
  heaterRate: number; // heat/sec continuously added to the vat, independent of melting
  coolerStored: number;

  actionCharge: number;
  bankedUnits: number; // finished copper cathode
  decantQualitySum: number; // for the batch's mean-quality telemetry

  forcedVents: number;
  decants: number;

  clock: number; // batch-elapsed ms
  status: BatchStatus;
  log: string[];
}

/* ============================================================================
   TUNING CONSTANTS
   ========================================================================== */
export const CFG = {
  GRADES: [1, 2, 8, 20] as BlockGrade[],
  SLAG_RANGE: {
    1: [1, 4],
    2: [3, 7],
    8: [5, 10],
    20: [8, 12],
  } as Record<BlockGrade, [number, number]>,

  // 500ms x units^0.6 — fits the design doc's table to within a few ms at
  // every grade (see §4.1: 500/760/1740/3000 for grades 1/2/8/20).
  MELT_BASE_MS: 500,
  MELT_EXPONENT: 0.6,

  // Refill delay scales with the block that vacated the slot, same
  // sublinear shape as melt time (§4.2) — a placeholder curve, not from
  // the doc's numbers (it doesn't give any), tune directly.
  REFILL_BASE_MS: 800,
  REFILL_EXPONENT: 0.6,

  ASSAY_DURATION_MS: 900,

  OFFER_SLOTS: 3,

  // --- Tank ---
  // A standing heat source, always running, independent of melting — a
  // dial rather than a byproduct. Melting alone produces heat in lumpy
  // bursts (one shot per block, otherwise flat until the next melt), which
  // made it hard to *sustain* a heat level long enough for pressure to
  // climb into the range where riding it pays off (§8.2). This gives
  // direct, continuous control over that instead of waiting on melt
  // cadence. Never off — 5 is the floor, not a toggled minimum — because a
  // real burner doesn't idle at zero.
  //
  // Sized against the rest of the heat economy, not picked in isolation —
  // a first version at 10-50 hit the 1000 ceiling from a cold, empty vat
  // in under 20 seconds with zero ore ever melted, because a *continuous
  // per-second* rate at the same nominal scale as melting's *per-event*
  // heat (HEAT_PER_ORE_UNIT x oreUnits, applied once per block) compounds
  // completely differently. 25/sec run flat-out alone takes ~40s to
  // overheat — genuinely dangerous if ignored, matching a block's melt
  // duration, but not an instant, silent trap.
  //
  // The actual min/max a player can dial the heater to now lives on the
  // equipped heater PART (rig.heaterMin/Max — see db/017_refine_precision_gear.sql)
  // rather than here; these numbers only survive as rigFromEffects()'s
  // fallback for a rig with no heater equipped at all.
  HEAT_PER_ORE_UNIT: 6, // heat added per unit of ore melted (open parameter)
  TANK_HEAT_CEILING: 1000, // hard ceiling — exceeding it ends the batch (overheat)
  PRESSURE_FORCED_VENT: 100, // soft-failure trigger
  // First-pass numbers here (0.05 / 0.4 against a flat decay of 3) let
  // pressure rocket from 0 to the forced-vent threshold in a handful of
  // seconds at completely ordinary heat/slag levels — effectively
  // unplayable, not just hard. Retuned so a moderately-run batch (heat
  // ~300-500, slag ~15-30) gains pressure at roughly 2-4/sec net, which is
  // survivable by periodic venting rather than constant panic-venting.
  PRESSURE_FROM_HEAT_PER_SEC: 0.006, // per heat unit currently in the tank
  PRESSURE_FROM_SLAG_PER_SEC: 0.08, // per slag unit currently in the tank
  PRESSURE_DECAY_PER_SEC: 3, // flat, not proportional — see §4.6
  // Optimal pressure band and its falloff are per-tier now (see
  // TIER_TUNING) — centered on this same 50 for every mineral, just
  // narrower for rarer ones.
  SEPARATION_RATE_MAX: 4, // ore units/sec at optimal pressure

  // Slag insulates the tank's ability to shed heat to the cooler — a
  // fraction of the dump rate lost per slag unit present, capped at 90%
  // loss so the vat is never mathematically un-coolable. 0.01/unit meant
  // ~90 slag (two or three unattended melts) already zeroed out cooling
  // entirely, which read as "the cooler doesn't work" rather than "you're
  // neglecting slag" — softened so insulation climbs gradually instead of
  // cliffing.
  SLAG_INSULATION_PER_UNIT: 0.004,
  SLAG_INSULATION_MAX: 0.9,

  // --- Cooler ---
  COOLER_CAPACITY: 400, // soft ceiling — saturating stalls dumping, doesn't end the batch
  // Ambient sink -> outside-world loss now lives on the radiator part
  // (rig.dissipationRate) — this is only rigFromEffects()'s fallback for a
  // rig with no radiator equipped.

  // --- Player actions ---
  // Vent amount is chosen per-click within the equipped valve's range
  // (rig.ventMin/Max, passed directly to applyVent()) rather than a flat
  // constant — this survives only as rigFromEffects()'s no-valve fallback.
  REMOVE_SLAG_AMOUNT: 4, // 1/click against 5-12 slag per melt read as "not working"

  ACTION_CAP: 100,
  ACTION_RECHARGE_PER_SEC: 12, // paused while melting, per §4.7
  ACTION_COST_VENT: 4, // cheapest — must stay reflexive
  ACTION_COST_REMOVE_SLAG: 6,
  ACTION_COST_DUMP_TOGGLE: 8, // only charged when switching dumping ON
  ACTION_COST_DECANT: 10,
  ACTION_COST_MELT_PER_SEC: 14, // drained continuously while held

  // A cap on state.log's length — nothing catastrophic without it at
  // today's tuning, but an unbounded array serialized into every tick
  // response is a needless and growing payload over a long batch.
  LOG_MAX_ENTRIES: 20,

  // Ore per finished unit at *perfect* conditions — constant across every
  // mineral. The skill ceiling doesn't move; only how much a bad decant
  // costs you does (see TIER_TUNING below).
  DECANT_ORE_BEST: 5,
} as const;

/* ============================================================================
   TIER TUNING — the actual difficulty/reward curve across minerals.
   ========================================================================== */

export interface TierTuning {
  decantOreWorst: number; // ore per finished unit at the worst conditions
  heatIdealFraction: number; // fraction of TANK_HEAT_CEILING that still scores heatScore=0 at
  pressureHalfWidth: number; // optimal pressure band is 50 +/- this
  slagHalfWidth: number; // optimal slag fraction band is 0.15 +/- this
  heatPerOreMultiplier: number; // scales CFG.HEAT_PER_ORE_UNIT — rarer ore dumps more heat per block
  pressureGainMultiplier: number; // scales pressure's rise from both heat and slag — rarer ore builds pressure faster
}

// Four tiers, matching mining's own tier field on ORE_TYPES (copper/zinc/
// iron = 1, ... rare earths = 4) — refining inherits the same rarity
// ladder rather than inventing a second one.
//
// decantOreBest is fixed at CFG.DECANT_ORE_BEST (5) for every tier — the
// skill ceiling never moves. What changes is how hard 5 is to actually
// reach (the tolerance windows below tighten every tier) and how much a
// bad decant costs when you miss it (decantOreWorst climbs from tier to
// tier). Tier 1 stays at 10 — the number already validated in play —
// specifically so copper's own feel is untouched by adding the other 12
// minerals; only tiers 2-4 are new range to climb through.
//
// heatPerOreMultiplier and pressureGainMultiplier are the actual physics,
// not just harder targets — a tantalum block genuinely dumps more heat and
// builds pressure faster than a copper one, matching the design doc's
// "narrower tolerances, faster drift, more heat dumped per block" (§4.1)
// rather than only the tolerance-window half of that sentence.
//
// A rig upgrade helps every mineral equally (the same cooler quadruples
// sinkRate whether you're refining copper or tantalum), so tier 4 stays
// harder than tier 1 on identical gear for *any* multiplier above 1 —
// no need to chase or outrun what a maxed rig can buy back. An earlier
// pass at these numbers (7x heat / 4x pressure) reasoned about a different
// question — "does the best cooler fully compensate tier 4?" — and got an
// answer nobody wanted: simulated back-to-back melting on a maxed rig
// overheated tantalum in ~2 seconds against copper's ~28, an 11x gap, not
// "somewhat harder." These are deliberately gentle instead — validated by
// the same simulation at roughly a 1.3-2x difference in time-to-overheat
// under identical, maximally-aggressive play.
const TIER_TUNING: Record<1 | 2 | 3 | 4, TierTuning> = {
  1: { decantOreWorst: 10, heatIdealFraction: 0.4, pressureHalfWidth: 10, slagHalfWidth: 0.05, heatPerOreMultiplier: 1.0, pressureGainMultiplier: 1.0 },
  2: { decantOreWorst: 30, heatIdealFraction: 0.3, pressureHalfWidth: 7, slagHalfWidth: 0.035, heatPerOreMultiplier: 1.15, pressureGainMultiplier: 1.1 },
  3: { decantOreWorst: 60, heatIdealFraction: 0.22, pressureHalfWidth: 5, slagHalfWidth: 0.025, heatPerOreMultiplier: 1.3, pressureGainMultiplier: 1.2 },
  4: { decantOreWorst: 100, heatIdealFraction: 0.15, pressureHalfWidth: 3, slagHalfWidth: 0.015, heatPerOreMultiplier: 1.5, pressureGainMultiplier: 1.35 },
};

export function tierTuning(oreType: OreTypeKey): TierTuning {
  return TIER_TUNING[ORE_TYPES[oreType].tier as 1 | 2 | 3 | 4];
}

/* ============================================================================
   RNG — mulberry32, same generator family as lib/mining-engine.ts, so a
   batch seed is fully reproducible for replay/telemetry.
   ========================================================================== */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rand: () => number, [lo, hi]: [number, number]): number {
  return lo + rand() * (hi - lo);
}

/* ============================================================================
   PURE HELPERS
   ========================================================================== */

export function meltDurationMs(grade: BlockGrade, rig: RefineRig): number {
  const base = CFG.MELT_BASE_MS * Math.pow(grade, CFG.MELT_EXPONENT);
  if (rig.meltSpeedMult <= 0) return Infinity; // no furnace installed — cannot melt
  return base / rig.meltSpeedMult;
}

export function refillDurationMs(grade: BlockGrade): number {
  return CFG.REFILL_BASE_MS * Math.pow(grade, CFG.REFILL_EXPONENT);
}

// Falloff width scales with the band itself (3x the half-width) so a
// tighter tier's separation-rate curve degrades over a proportionally
// tighter margin too, rather than a fixed distance that would barely
// matter once the band itself has shrunk to +-3.
function pressureEfficiency(pressure: number, tuning: TierTuning): number {
  const low = 50 - tuning.pressureHalfWidth;
  const high = 50 + tuning.pressureHalfWidth;
  if (pressure >= low && pressure <= high) return 1;
  const dist = pressure < low ? low - pressure : pressure - high;
  return Math.max(0, 1 - dist / (tuning.pressureHalfWidth * 3));
}

// Deliberately NOT the same curve as pressureEfficiency() above. That one
// is symmetric because separation genuinely runs slower on either side of
// the band (§4.5) — but decant quality using the same symmetric band made
// good ratios unreachable in practice: pressure decays flat (§4.6, on
// purpose, so it can't passively self-stabilize), so there is no resting
// point *inside* 40-60 — pressure only sits there via continuous
// sub-second vent taps, which a network round-trip per click can't
// support. That meant the "safe" way to play (dump heat, let pressure
// drain toward 0) scored ~0.33 on this axis no matter how well heat and
// slag were managed, capping decant ratio around 7 regardless of skill.
// This curve is asymmetric instead: pressure anywhere from 0 up to the
// optimal ceiling already scores well (low pressure is the safe, ordinary
// resting state, not a second penalty on top of separation's own), and
// only riding it up past the ceiling toward the forced-vent threshold
// costs quality — which is exactly the reward structure the design doc's
// "riding tolerance" skill (§8.2: better grade at higher collapse risk)
// describes, rather than a mandatory knife-edge just to hit an average
// decant.
function decantPressureScore(pressure: number, tuning: TierTuning): number {
  const high = 50 + tuning.pressureHalfWidth;
  const low = 50 - tuning.pressureHalfWidth;
  if (pressure <= high) {
    return 1 - Math.max(0, low - pressure) / 200;
  }
  return Math.max(0, 1 - (pressure - high) / 40);
}

// Three raw inputs -> one 0..1 "how good is a decant right now" score. Each
// axis has its own comfortable middle; averaging them (rather than
// multiplying) means one bad axis degrades quality without necessarily
// zeroing it out — the visible meter (§4.9) reads this same function.
// `tuning` is the batch's ore-tier tolerance windows (see TIER_TUNING) —
// the same heat/pressure/slag values score worse on a rare-earth batch
// than on a copper one, by design.
export function decantQuality(
  heat: number,
  pressure: number,
  slagFraction: number,
  tuning: TierTuning,
): number {
  const heatIdealHigh = tuning.heatIdealFraction * CFG.TANK_HEAT_CEILING;
  const heatScore = Math.max(0, 1 - heat / heatIdealHigh);
  const pressureScore = decantPressureScore(pressure, tuning);
  // Ideal slag is a maintained middle (§4.6), not zero — score peaks
  // around 15% of tank volume and falls off either side, over a band
  // scaled the same way pressure's is (3x the half-width).
  const slagTarget = 0.15;
  const slagScore = Math.max(
    0,
    1 - Math.abs(slagFraction - slagTarget) / (tuning.slagHalfWidth * 3),
  );
  return (heatScore + pressureScore + slagScore) / 3;
}

export function decantRatio(quality: number, tuning: TierTuning): number {
  const q = Math.max(0, Math.min(1, quality));
  return (
    tuning.decantOreWorst - q * (tuning.decantOreWorst - CFG.DECANT_ORE_BEST)
  );
}

export function slagInsulationFactor(slagUnits: number): number {
  return Math.min(
    CFG.SLAG_INSULATION_MAX,
    slagUnits * CFG.SLAG_INSULATION_PER_UNIT,
  );
}

// The actual heat/sec the cooler is shedding right now, accounting for fin
// power and slag insulation — exposed so the UI can show a live "sinking
// X/sec" readout instead of the player having to infer it from the heat
// gauge's slope. Zero whenever dumping is off or the cooler is saturated.
export function effectiveSinkRate(
  rig: RefineRig,
  tankSlag: number,
  finPower: number,
  dumping: boolean,
  coolerStored: number,
): number {
  if (!dumping || coolerStored >= CFG.COOLER_CAPACITY) return 0;
  const insulation = slagInsulationFactor(tankSlag);
  return rig.sinkRate * finPower * (1 - insulation);
}

// Grade is the exact ore-unit count a block carries (§4.1's ratio table),
// but showing "G8" / "G20" next to mining's 1-4 grade badges reads as a
// different, unexplained scale. This maps the four block sizes onto the
// same 1-4 tier language mining already uses.
const GRADE_TIER: Record<BlockGrade, 1 | 2 | 3 | 4> = { 1: 1, 2: 2, 8: 3, 20: 4 };
export function gradeTier(grade: BlockGrade): 1 | 2 | 3 | 4 {
  return GRADE_TIER[grade];
}

function clone(state: BatchState): BatchState {
  return {
    ...state,
    offer: state.offer.map((slot) => ({
      block: slot.block ? { ...slot.block } : null,
      refillReadyAt: slot.refillReadyAt,
    })) as BatchState["offer"],
    melting: state.melting
      ? { ...state.melting, block: { ...state.melting.block } }
      : null,
    log: state.log,
  };
}

// maxUnits caps which grades are even eligible to be drawn — without this,
// the offer could present (and let you melt) more ore than the batch
// actually has left, since a block's oreUnits equals its grade with no
// relation to how much of the bid is still unclaimed. Returns null when
// nothing fits (maxUnits < the smallest grade, 1) — the caller leaves that
// slot empty rather than drawing anyway.
function rollBlock(rand: () => number, id: number, maxUnits: number): Block | null {
  const eligible = CFG.GRADES.filter((g) => g <= maxUnits);
  if (eligible.length === 0) return null;
  const grade = eligible[Math.floor(rand() * eligible.length)];
  const slagUnits = randRange(rand, CFG.SLAG_RANGE[grade]);
  return { id, grade, oreUnits: grade, slagUnits, revealed: false, assayStartedAt: null };
}

// Sum of oreUnits currently sitting in the offer, unmelted — this includes
// a block that's mid-melt (its slot isn't cleared until the melt
// completes, see the melt-progress branch in tick() below), since that
// ore hasn't actually left oreRemaining yet either. This is the "already
// spoken for" amount a new block's grade has to fit around.
export function reservedOreUnits(offer: BatchState["offer"]): number {
  return offer.reduce((sum, slot) => sum + (slot.block?.oreUnits ?? 0), 0);
}

/* ============================================================================
   BATCH LIFECYCLE
   ========================================================================== */

// bidUnits is the player's pre-run size bid (§6.3) — validated by the
// caller against how much ore they actually own before this is called.
export function createBatch(
  seed: number,
  rig: RefineRig,
  bidUnits: number,
  oreType: OreTypeKey,
): BatchState {
  const rand = mulberry32(seed);
  let nextBlockId = 1;
  let budget = bidUnits;
  const offer = [0, 1, 2].map(() => {
    const block = rollBlock(rand, nextBlockId, budget);
    if (block) {
      nextBlockId++;
      budget -= block.oreUnits;
    }
    return { block, refillReadyAt: null };
  }) as BatchState["offer"];

  return {
    seed,
    rig,
    oreType,
    bidUnits,
    oreRemaining: bidUnits,
    offer,
    nextBlockId,
    melting: null,
    tankOre: 0,
    tankSlag: 0,
    readyOre: 0,
    heat: 0,
    pressure: 0,
    dumping: false,
    finPower: 1,
    heaterRate: rig.heaterMin,
    coolerStored: 0,
    actionCharge: CFG.ACTION_CAP,
    bankedUnits: 0,
    decantQualitySum: 0,
    forcedVents: 0,
    decants: 0,
    clock: 0,
    status: "active",
    log: [],
  };
}

export interface ApplyResult {
  s: BatchState;
  err?: string;
}

// Advances the batch by dtMs of real time. The caller is responsible for
// calling this frequently enough (e.g. on every action, plus a lightweight
// poll) that melt/assay completion and the forced-vent/overheat checks
// don't drift far behind the wall clock.
export function tick(state: BatchState, dtMs: number): BatchState {
  if (state.status !== "active") return state;
  const s = clone(state);
  const dtSec = dtMs / 1000;
  s.clock += dtMs;

  // RNG re-derived from seed + clock for anything rolled mid-tick (new
  // block grades on refill) — deterministic replay without threading a
  // live generator through every call.
  const rand = mulberry32(s.seed ^ Math.floor(s.clock));
  const tuning = tierTuning(s.oreType);

  // --- assay reveals ---
  for (const slot of s.offer) {
    if (slot.block && !slot.block.revealed && slot.block.assayStartedAt !== null) {
      if (s.clock - slot.block.assayStartedAt >= CFG.ASSAY_DURATION_MS) {
        slot.block.revealed = true;
      }
    }
  }

  // --- offer refill ---
  // Capped to whatever's actually left in the bid, not just "a random
  // grade" — see rollBlock()'s comment. A slot that can't fit even a
  // grade-1 block (nothing left unclaimed) just stays empty: there's
  // nothing more this batch can offer, on this slot or any other, since
  // reservedOreUnits() only shrinks when oreRemaining itself does (a melt
  // completing removes a block from both at once — see below).
  for (const slot of s.offer) {
    if (!slot.block && slot.refillReadyAt !== null && s.clock >= slot.refillReadyAt) {
      const freeCapacity = s.oreRemaining - reservedOreUnits(s.offer);
      const block = rollBlock(rand, s.nextBlockId, freeCapacity);
      if (block) {
        s.nextBlockId++;
        slot.block = block;
      }
      slot.refillReadyAt = null;
    }
  }

  // --- melt progress ---
  if (s.melting && s.clock - s.melting.startedAt >= s.melting.durationMs) {
    const { block, slotIndex } = s.melting;
    s.tankOre += block.oreUnits;
    s.tankSlag += block.slagUnits;
    s.heat += block.oreUnits * CFG.HEAT_PER_ORE_UNIT * tuning.heatPerOreMultiplier;
    s.oreRemaining -= block.oreUnits;
    s.offer[slotIndex] = {
      block: null,
      refillReadyAt: s.clock + refillDurationMs(block.grade),
    };
    s.melting = null;
  } else if (s.melting) {
    // Action bar drains continuously while a melt is held (§4.7).
    s.actionCharge = Math.max(
      0,
      s.actionCharge - CFG.ACTION_COST_MELT_PER_SEC * dtSec,
    );
  } else {
    // Recharge pauses while melting; otherwise it's always ticking, even
    // above the cap is clamped, not banked (§4.7).
    s.actionCharge = Math.min(
      CFG.ACTION_CAP,
      s.actionCharge + CFG.ACTION_RECHARGE_PER_SEC * dtSec,
    );
  }

  // --- vat heater: a standing heat source, independent of melting ---
  s.heat += s.heaterRate * dtSec;

  // --- separation: raw tank ore -> ready (decantable) ore ---
  const sepRate = CFG.SEPARATION_RATE_MAX * pressureEfficiency(s.pressure, tuning);
  const separated = Math.min(s.tankOre, sepRate * dtSec);
  s.tankOre -= separated;
  s.readyOre += separated;

  // --- pressure ---
  // Decay is NOT scaled by tuning — it's the flat, ore-independent
  // baseline every batch fights against (§4.6); only the *gain* side (how
  // fast heat/slag actually build pressure) is a property of the mineral
  // itself, same as heatPerOreMultiplier above.
  s.pressure +=
    ((s.heat * CFG.PRESSURE_FROM_HEAT_PER_SEC +
      s.tankSlag * CFG.PRESSURE_FROM_SLAG_PER_SEC) *
      tuning.pressureGainMultiplier -
      CFG.PRESSURE_DECAY_PER_SEC) *
    dtSec;
  s.pressure = Math.max(0, s.pressure);

  // --- forced vent (soft failure, §6.6) ---
  if (s.pressure >= CFG.PRESSURE_FORCED_VENT) {
    s.pressure = 50 + tuning.pressureHalfWidth;
    s.readyOre = 0; // loses already-melted material, strictly worse than raw ore
    s.forcedVents += 1;
    s.log = [
      ...s.log,
      `forced vent at t=${Math.round(s.clock)}ms`,
    ].slice(-CFG.LOG_MAX_ENTRIES);
  }

  // --- cooler ---
  if (s.dumping && s.coolerStored < CFG.COOLER_CAPACITY) {
    const insulation = slagInsulationFactor(s.tankSlag);
    const effectiveRate = s.rig.sinkRate * s.finPower * (1 - insulation);
    const transfer = Math.min(
      s.heat,
      effectiveRate * dtSec,
      CFG.COOLER_CAPACITY - s.coolerStored,
    );
    s.heat -= transfer;
    s.coolerStored += transfer;
  }
  // Sink -> ambient, governed by the radiator part (rig.dissipationRate) —
  // previously a flat constant no upgrade touched at all, which meant a
  // maxed-out cooler could fill the sink faster without the sink itself
  // ever draining any faster in return.
  s.coolerStored = Math.max(
    0,
    s.coolerStored - s.rig.dissipationRate * dtSec,
  );

  // --- overheat (hard failure, §6.6) ---
  if (s.heat >= CFG.TANK_HEAT_CEILING) {
    s.status = "overheat";
  }

  return s;
}

/* ============================================================================
   PLAYER ACTIONS — each validates and returns { s, err }. err is set (and
   state unchanged) when the action can't happen right now; callers surface
   err to the client the same way mining's run routes do.
   ========================================================================== */

export function startAssay(
  state: BatchState,
  slotIndex: number,
): ApplyResult {
  const slot = state.offer[slotIndex];
  if (!slot?.block) return { s: state, err: "no block in that slot" };
  if (slot.block.revealed || slot.block.assayStartedAt !== null) {
    return { s: state, err: "already assaying" };
  }
  const s = clone(state);
  s.offer[slotIndex].block!.assayStartedAt = s.clock;
  return { s };
}

export function startMelt(state: BatchState, slotIndex: number): ApplyResult {
  if (state.melting) return { s: state, err: "already melting" };
  const slot = state.offer[slotIndex];
  if (!slot?.block) return { s: state, err: "no block in that slot" };
  const duration = meltDurationMs(slot.block.grade, state.rig);
  if (!Number.isFinite(duration)) return { s: state, err: "no furnace equipped" };

  const s = clone(state);
  s.melting = {
    block: slot.block,
    slotIndex,
    startedAt: s.clock,
    durationMs: duration,
  };
  return { s };
}

// One unit per call, not "drain everything ready right now" — a bulk
// decant meant a single click either did nothing worth seeing or dumped
// the whole tank in one shot, with no way to bank some units now while
// deliberately leaving the rest to keep separating (e.g. holding some back
// so the tank empties right as the batch ends). Repeated clicks (paced
// only by the action-bar cost, same as every other action) is how you
// decant a large amount — 40 ready ore at ratio ~8 takes ~5 clicks.
export function applyDecant(state: BatchState): ApplyResult {
  if (state.actionCharge < CFG.ACTION_COST_DECANT) {
    return { s: state, err: "not enough action charge" };
  }

  const tuning = tierTuning(state.oreType);
  const tankVolume = state.tankOre + state.tankSlag + state.readyOre;
  const slagFraction = tankVolume > 0 ? state.tankSlag / tankVolume : 0;
  const quality = decantQuality(state.heat, state.pressure, slagFraction, tuning);
  const ratio = decantRatio(quality, tuning);

  if (state.readyOre < ratio) {
    return { s: state, err: "not enough separated ore for a full unit" };
  }

  const s = clone(state);
  s.actionCharge -= CFG.ACTION_COST_DECANT;
  s.readyOre -= ratio;
  s.bankedUnits += 1;
  s.decants += 1;
  s.decantQualitySum += quality;
  return { s };
}

// The Auto-Decanter unlock's "Decant All" — converts everything currently
// affordable in ready ore in one action, same single action-bar cost as a
// single decant. Deliberately a separate function, not a parameter on
// applyDecant(): the two serve different moments — one decant at a time
// for precisely tuning down to the last few units without waste near the
// end of a batch, all-at-once for banking a good, stable window in bulk
// without spamming clicks. Gated at the API layer on owning the unlock
// (see /api/refine/[id]/decant-all), same as mining's ore-siphon check.
export function applyDecantAll(state: BatchState): ApplyResult {
  if (state.actionCharge < CFG.ACTION_COST_DECANT) {
    return { s: state, err: "not enough action charge" };
  }

  const tuning = tierTuning(state.oreType);
  const tankVolume = state.tankOre + state.tankSlag + state.readyOre;
  const slagFraction = tankVolume > 0 ? state.tankSlag / tankVolume : 0;
  const quality = decantQuality(state.heat, state.pressure, slagFraction, tuning);
  const ratio = decantRatio(quality, tuning);
  const units = Math.floor(state.readyOre / ratio);

  if (units <= 0) {
    return { s: state, err: "not enough separated ore for a full unit" };
  }

  const s = clone(state);
  s.actionCharge -= CFG.ACTION_COST_DECANT;
  s.readyOre -= units * ratio;
  s.bankedUnits += units;
  s.decants += 1;
  s.decantQualitySum += quality;
  return { s };
}

// Releases the given amount of pressure, clamped to the equipped valve's
// range (rig.ventMin/ventMax) — one explicit button per amount (see the
// valve's min/max, exposed as its own row of buttons in the UI) rather
// than a persisted slider setting, so a click is a single, immediate,
// unambiguous action instead of "set the dial, then remember to press
// vent." A basic valve still gives real range to trim down from the old
// fixed 45; a precision valve reaches a 1-point bleed for holding a
// tier-4-narrow band.
export function applyVent(state: BatchState, amount: number): ApplyResult {
  if (state.actionCharge < CFG.ACTION_COST_VENT) {
    return { s: state, err: "not enough action charge" };
  }
  const clamped = Math.max(
    state.rig.ventMin,
    Math.min(state.rig.ventMax, amount),
  );
  const s = clone(state);
  s.actionCharge -= CFG.ACTION_COST_VENT;
  s.pressure = Math.max(0, s.pressure - clamped);
  return { s };
}

export function applyRemoveSlag(state: BatchState): ApplyResult {
  if (state.actionCharge < CFG.ACTION_COST_REMOVE_SLAG) {
    return { s: state, err: "not enough action charge" };
  }
  if (state.tankSlag <= 0) return { s: state, err: "no slag to remove" };
  const s = clone(state);
  s.actionCharge -= CFG.ACTION_COST_REMOVE_SLAG;
  s.tankSlag = Math.max(0, s.tankSlag - CFG.REMOVE_SLAG_AMOUNT);
  return { s };
}

// Toggling dumping ON costs action; toggling it OFF is free, on the same
// "safety controls must stay reflexive" logic as venting (§4.7's testing
// note) — a player should never be action-starved out of turning dumping
// back off.
export function applyToggleDump(state: BatchState): ApplyResult {
  const turningOn = !state.dumping;
  if (turningOn && state.actionCharge < CFG.ACTION_COST_DUMP_TOGGLE) {
    return { s: state, err: "not enough action charge" };
  }
  const s = clone(state);
  if (turningOn) s.actionCharge -= CFG.ACTION_COST_DUMP_TOGGLE;
  s.dumping = turningOn;
  return { s };
}

// Raise/lower the fins (§4.11) — a passive dial, not a triggered action, so
// it's free and always available like turning dumping off. Clamped to
// 0..1; the client sends a 0-100 percentage.
export function applySetFinPower(state: BatchState, power: number): ApplyResult {
  const s = clone(state);
  s.finPower = Math.max(0, Math.min(1, power));
  return { s };
}

// The vat heater dial — same free, always-available shape as fin power.
// Clamped to the equipped heater's own range (rig.heaterMin/Max), not a
// fixed global floor: a basic heater still floors at the old 5, a
// precision heater reaches down to 1 for a genuinely low standing burn.
// Floored at heaterMin rather than allowing 0 either way — this is a
// standing burner, not a toggle.
export function applySetHeaterRate(state: BatchState, rate: number): ApplyResult {
  const s = clone(state);
  s.heaterRate = Math.max(
    state.rig.heaterMin,
    Math.min(state.rig.heaterMax, rate),
  );
  return { s };
}

// The Coolant Flush consumable (db/016_refine_expansion.sql) — instantly
// empties the cooler back to 0, same as if it had fully dissipated on its
// own. Free in action-charge terms; the cost is the one-time item itself,
// checked and debited by the caller (see /api/refine/[id]/coolant) exactly
// like mining's ore-siphon/line-scanner consumables — this function only
// knows how to apply the effect, not whether the player owns one.
export function applyUseCoolant(state: BatchState): ApplyResult {
  const s = clone(state);
  s.coolerStored = 0;
  return { s };
}

// The deliberate early exit (§6.4). Unmelted ore (oreRemaining, plus
// whatever's still sitting in the offer/mid-melt) is the caller's to
// return to the player's ore inventory; melted-but-undecanted material
// (tankOre/tankSlag/readyOre) is lost either way, same as overheat.
export function applyShutdown(state: BatchState): ApplyResult {
  if (state.status !== "active") return { s: state, err: "batch already ended" };
  const s = clone(state);
  s.status = "shutdown";
  return { s };
}

export function meanDecantQuality(state: BatchState): number {
  return state.decants > 0 ? state.decantQualitySum / state.decants : 0;
}
