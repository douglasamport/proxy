// Extraction run engine — ported verbatim from the standalone prototype
// (run-prototype.html). Pure functions only: no DOM, no Math.random outside
// mulberry32, no Date.now. Portable into a server context for replay
// verification later (see app/api/runs/route.ts).

export type SurveyTier = 'none' | 'basic' | 'full';
export type DirKey = 'N' | 'S' | 'E' | 'W';
export type RunStatus = 'active' | 'banked' | 'stranded' | 'wrecked';

export interface Alloc {
  fuel: number;
  cargo: number;
  armour: number;
  drive: number;
  steer: number;
  sensor: number;
  analyser: number;
}

export interface Chassis {
  alloc: Alloc;
  fuelCap: number;
  hold: number;
  sinkCap: number;
  speed: number;
  movement: number;
  sensorRange: number;
  sensorBlur: number;
  pingFuel: number;
  analyser: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Pocket extends Point {
  tier: number;
}

export interface Cell {
  x: number;
  y: number;
  tier: number;
  units: number;
  hazard: number;
  gas: boolean;
  seam: boolean;
  cavern: boolean;
  spent: boolean;
  dug: boolean;
  known: boolean;
  tier_kept?: number;
}

export interface OreLoad {
  tier: number;
  units: number;
}

export interface Contact {
  key: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  blur: number;
  fixes: number;
  mass: number;
  tier: number;
  lo?: number;
  hi?: number;
  survey?: boolean;
}

export interface LogEntry {
  n: number;
  t: string;
  c: number;
  k: string;
}

export interface OreCluster {
  cx: number;
  cy: number;
  mass: number;
  tier: number;
  cells: number;
}

export interface SurveyReport {
  pockets: number;
  mass: number;
  depth: number;
  richFar: number;
  rich: number;
  fuzz: number;
  byGrade: number[] | null;
}

export interface RunState {
  seed: number;
  chassis: Chassis;
  cells: Cell[];
  base: Point;
  x: number;
  y: number;
  dir: DirKey | null;
  fuel: number;
  sink: number;
  energy: number;
  carrying: OreLoad[];
  banked: OreLoad[];
  fuelUsed: number;
  sinkLost: number;
  trip: number;
  refuels: number;
  survey: SurveyTier;
  surveyCost: number;
  claimCost: number;
  contacts: Contact[];
  pings: number;
  pingReady: number;
  bearing: { dir: string; mass: number } | null;
  seen: Set<number>;
  energyStart: number;
  log: LogEntry[];
  status: RunStatus;
  step: number;
  // Cost-to-base cache, keyed to the step it was computed at. Mutated
  // directly on the state object by returnCost() — a deliberate exception
  // to the clone-then-mutate pattern the rest of the engine follows.
  _home?: Float64Array;
  _homeStep?: number;
}

export interface ApplyResult {
  s: RunState;
  err?: string;
}

export interface ScoreResult {
  units: number;
  value: number;
  revenue: number;
  fuelCost: number;
  repair: number;
  cost: number;
  launch: number;
  surveyCost: number;
  claimCost: number;
  survey: SurveyTier;
  trips: number;
  energyLeft: number;
  energyUsed: number;
  claimSpent: number;
  net: number;
  grade: number;
  costPerUnit: number;
  margin: number;
  lost: number;
  status: RunStatus;
}

interface SurveySpec {
  cost: number;
  blur: number;
  label: string;
  note: string;
}

/* ============================================================================
   TUNING CONSTANTS — everything balance-related lives here
   ========================================================================== */
export const CFG = {
  // Field size is derived from the claim — a bigger claim is a bigger dig site.
  // Set at run creation; see fieldDims().
  W: 14, H: 10,
  BLOCK_W: 14, BLOCK_H: 10,   // the site exists independently of what you claim
  ORE_HEADROOM: 1.60,     // target ore in the ground, as a multiple of the claim

  VOLUME_TOTAL: 16,
  // per allocated volume unit
  FUEL_PER_UNIT:   24,
  HOLD_PER_UNIT:    5,
  SINK_PER_PLATE:  12,
  SPEED_PER_UNIT: 0.20,   // drive
  MOVE_PER_UNIT:  0.22,   // steering
  SENSOR_RANGE_BASE: 2.5, // ping radius with zero sensor volume
  SENSOR_RANGE_PER:  1.9,
  SENSOR_BLUR_BASE:  2.4, // position uncertainty in cells, lower is better
  SENSOR_BLUR_PER:  -0.38,
  PING_FUEL_BASE:    4.0,
  PING_FUEL_PER:    -0.35,
  PING_COOLDOWN:     6,   // moves between pings
  ANALYSER_BASE:     3,   // grade-estimate width, in tiers
  ANALYSER_PER:     -0.8,

  // hull baseline with zero allocation
  BASE_FUEL: 12,
  BASE_HOLD:  2,
  BASE_SINK: 10,
  BASE_SPEED: 0.70,     // cells per fuel
  BASE_MOVE:  0.70,     // turn-cost divisor

  TURN_BASE:    1.20,   // fuel to change direction, divided by movement
  EXTRACT_FUEL: 1.50,   // flat fuel per node extracted
  DIG_FUEL:     0.90,   // surcharge for cutting into fresh rock
  TUNNEL_MULT:  0.40,   // cost multiplier for driving an existing tunnel

  // field generation — sparser is better; scarcity is what makes choices hurt
  // Discrete pockets at unknown locations — no value gradient to solve.
  DEPOSITS_PER_100: 5.4,  // rich pockets per 100 cells
  DEPOSIT_SPREAD: 1.9,    // pocket radius in cells
  DEPOSIT_DENSITY: 0.62,  // chance a cell inside a pocket carries ore
  STRAY_ORE: 0.022,       // lone low-grade cells outside any pocket
  ORE_UNITS_MIN: 2,
  ORE_UNITS_MAX: 7,
  TIER_GATE: [0, 0, 0.14, 0.30, 0.46],   // pocket distance gates its grade

  // Terrain — none of this is metal, so none of it shows on sensors.
  SEAM_CLUSTERS_PER_100: 3.2,   // undiggable rock
  SEAM_SPREAD: 1.6,
  GAS_PER_100: 2.6,             // pockets that hit 2-3x
  GAS_SPREAD: 1.4,
  GAS_MULT: 2.75,
  CAVERN_PER_100: 1.7,          // pre-cut ground: free to enter, cheap to cross
  CAVERN_SPREAD: 2.2,

  ENERGY: 35,           // DEFAULT claim only — the player sets this at fitting
  ENERGY_MAX: 50,       // hard ceiling on a single run's claim
  AI_SINK_STOP: 0.30,   // baseline calls it a day below this share of sink

  GRADE_VALUE: [0, 1, 3, 8, 20],

  // economics — target ~20% of revenue consumed by fuel + repair
  ORE_PRICE: 6.5,
  LAUNCH_COST: 45,     // flat cost to put the rig on site — the reason to claim big
  // Surveys: bought before the run. They locate metal, never terrain, never grade.
  SURVEY: {
    none:  { cost:0,   blur:0,   label:'None',     note:'Go in blind. Cheapest, and the only way to be surprised.' },
    basic: { cost:50, blur:3.2, label:'Basic',    note:'Pocket count and mass. Positions very rough.' },
    full:  { cost:120, blur:1.7, label:'Detailed', note:'Same, at workable resolution. Still no grade, still no terrain.' }
  } as Record<SurveyTier, SurveySpec>,
  // Claim size is its own purchase now, on top of the flat launch cost —
  // bigger claims still cost less per unit (30/20 vs 55/50), same lesson
  // as before, just with a real price tag on the choice itself.
  CLAIM_OPTIONS: [20, 35, 50],
  CLAIM_COST: { 20: 30, 35: 45, 50: 55 } as Record<number, number>,
  AI_SURVEY: 'basic' as SurveyTier,   // unattended runs always buy one — that is what a survey is for
  AI_MARGIN: 1.40,     // absolute floor: don't cut ore that fails to cover its own fuel
  AI_REACH: 0.20,      // and never travel further than this share of the tank for ANY ore,
                       // whatever its grade — the cap is what stops the baseline cherry-picking
  FUEL_PRICE: 2.0,
  REPAIR_PER_SINK: 2,

  AI_SAFETY: 1.18,      // baseline turns back at this margin
  AI_RESERVE: 3.0       // extra fuel the baseline always keeps in hand
};

/* ============================================================================
   ENGINE — pure functions, no DOM, no Math.random, no Date.now
   Portable straight into a Node service later.
   ========================================================================== */

export function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function chassisFrom(alloc: Alloc): Chassis {
  return {
    alloc,
    fuelCap: CFG.BASE_FUEL + alloc.fuel  * CFG.FUEL_PER_UNIT,
    hold:    CFG.BASE_HOLD + alloc.cargo * CFG.HOLD_PER_UNIT,
    sinkCap: CFG.BASE_SINK + alloc.armour* CFG.SINK_PER_PLATE,
    speed:   CFG.BASE_SPEED + alloc.drive * CFG.SPEED_PER_UNIT,
    movement:CFG.BASE_MOVE  + alloc.steer * CFG.MOVE_PER_UNIT,
    sensorRange: CFG.SENSOR_RANGE_BASE + alloc.sensor * CFG.SENSOR_RANGE_PER,
    sensorBlur:  Math.max(0.35, CFG.SENSOR_BLUR_BASE + alloc.sensor * CFG.SENSOR_BLUR_PER),
    pingFuel:    Math.max(1.2,  CFG.PING_FUEL_BASE  + alloc.sensor * CFG.PING_FUEL_PER),
    analyser:    Math.max(0.6,  CFG.ANALYSER_BASE   + alloc.analyser * CFG.ANALYSER_PER)
  };
}

export const idx = (x: number, y: number) => y * CFG.W + x;
export const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < CFG.W && y < CFG.H;

// A claim should be spendable but never comfortably — the site holds
// ORE_HEADROOM x the claim, so there is always ore you must leave behind.
// The block is the same size whatever you claim. How much ore it holds varies by
// seed — which is the whole point of surveying before you decide how much of your
// day to commit to it.
export function fieldDims(): { W: number; H: number } {
  return { W: CFG.BLOCK_W, H: CFG.BLOCK_H };
}

function scatter(rng: () => number, count: number, base: Point, minD: number): Point[] {
  const pts: Point[] = [];
  let tries = 0;
  while (pts.length < count && tries++ < count * 40) {
    const x = rng() * (CFG.W - 1), y = rng() * (CFG.H - 1);
    if (Math.hypot(x - base.x, y - base.y) < minD) continue;
    pts.push({ x, y });
  }
  return pts;
}

export function generateField(seed: number): { cells: Cell[]; base: Point; pockets: Pocket[] } {
  const rng = mulberry32(seed);
  const base = { x: 0, y: (CFG.H >> 1) };
  const area = CFG.W * CFG.H;
  const maxD = Math.hypot(CFG.W - 1, CFG.H - 1);
  const per = (n: number) => Math.max(1, Math.round(area * n / 100));

  // Rich pockets at unknown locations. Grade is a property of the POCKET, not of
  // distance — so there is no gradient to solve, only pockets to find.
  const pockets: Pocket[] = scatter(rng, per(CFG.DEPOSITS_PER_100), base, 2.4).map(p => {
    const d = Math.hypot(p.x - base.x, p.y - base.y) / maxD;
    const roll = rng() + d * 0.5;
    let tier = roll < 0.40 ? 1 : roll < 0.70 ? 2 : roll < 0.92 ? 3 : 4;
    while (tier > 1 && d < CFG.TIER_GATE[tier]) tier--;
    return { ...p, tier };
  });
  const seams   = scatter(rng, per(CFG.SEAM_CLUSTERS_PER_100), base, 2.2);
  const gas     = scatter(rng, per(CFG.GAS_PER_100), base, 3.0);
  const caverns = scatter(rng, per(CFG.CAVERN_PER_100), base, 3.4);

  function near<T extends Point>(pts: T[], x: number, y: number, spread: number): { p: T; d: number } | null {
    let best: T | null = null, bd = Infinity;
    for (const p of pts) {
      const dd = Math.hypot(p.x - x, p.y - y);
      if (dd < bd) { bd = dd; best = p; }
    }
    return bd <= spread ? { p: best as T, d: bd } : null;
  }

  const cells: Cell[] = [];
  for (let y = 0; y < CFG.H; y++) {
    for (let x = 0; x < CFG.W; x++) {
      const isBase = (x === base.x && y === base.y);
      const d = Math.hypot(x - base.x, y - base.y) / maxD;
      const c: Cell = { x, y, tier: 0, units: 0, hazard: 0, gas: false, seam: false,
                  cavern: false, spent: false, dug: false, known: false };
      if (isBase) { c.dug = true; c.known = true; cells.push(c); continue; }

      const cav = near(caverns, x, y, CFG.CAVERN_SPREAD);
      // pre-cut, so cheap to cross — but you still have to find it
      if (cav && rng() < 1 - (cav.d / CFG.CAVERN_SPREAD) * 0.75) { c.cavern = true; c.dug = true; }
      c.known = false;

      const sm = near(seams, x, y, CFG.SEAM_SPREAD);
      if (!c.cavern && sm && rng() < 1 - (sm.d / CFG.SEAM_SPREAD) * 0.55) { c.seam = true; }

      if (!c.seam) {
        const pk = near(pockets, x, y, CFG.DEPOSIT_SPREAD);
        if (pk && rng() < CFG.DEPOSIT_DENSITY * (1 - (pk.d / CFG.DEPOSIT_SPREAD) * 0.6)) {
          c.tier  = Math.max(1, pk.p.tier - (pk.d > CFG.DEPOSIT_SPREAD * 0.65 ? 1 : 0));
          c.units = CFG.ORE_UNITS_MIN + Math.floor(rng() * (CFG.ORE_UNITS_MAX - CFG.ORE_UNITS_MIN + 1));
        } else if (rng() < CFG.STRAY_ORE) {
          c.tier = 1; c.units = 1 + Math.floor(rng() * 3);
        }
      }

      if (!c.seam && !c.cavern) {
        const gp = near(gas, x, y, CFG.GAS_SPREAD);
        if (gp && rng() < 1 - (gp.d / CFG.GAS_SPREAD) * 0.5) {
          c.gas = true;
          c.hazard = Math.round((2 + Math.floor(rng() * 3)) * CFG.GAS_MULT);
        } else if (rng() < 0.05 + 0.14 * d) {
          c.hazard = 1 + Math.floor(rng() * (2 + 3 * d));
        }
      }
      cells.push(c);
    }
  }
  return { cells, base, pockets };
}

// A survey is a coarse map-wide ping bought before launch. It reports pocket
// position and mass only — never grade, never terrain. Its blur is fixed and
// deliberately wide, so it tells you WHERE to dig and nothing about what you'll hit.
// What a human gets: totals, never positions. Fog stays intact, and the report
// answers the only question it needs to — is this face worth 20 energy or 50?
export function surveyReport(seed: number, tier: SurveyTier): SurveyReport | null {
  if (tier === 'none') return null;
  const dims = fieldDims(); CFG.W = dims.W; CFG.H = dims.H;
  const f = generateField(seed);
  const tmp = { cells: f.cells, base: f.base } as RunState;
  const groups = oreClusters(tmp);
  const maxD = Math.hypot(CFG.W - 1, CFG.H - 1);
  let mass = 0, far = 0, richFar = 0;
  const byGrade = [0, 0, 0, 0, 0];
  for (const g of groups) {
    const d = Math.hypot(g.cx - f.base.x, g.cy - f.base.y) / maxD;
    mass += g.mass;
    byGrade[g.tier] += g.mass;
    if (d > 0.45) far += g.mass;                       // beyond comfortable reach
    if (d > 0.45 && g.tier >= 3) richFar += g.mass;    // and worth the trip
  }
  const detail = tier === 'full';
  return {
    pockets: groups.length,
    mass,
    depth: mass ? far / mass : 0,      // share of ore sitting far out, not a mean
    richFar,
    rich: byGrade[3] + byGrade[4],
    // a cheap survey rounds everything off; a detailed one doesn't
    fuzz: detail ? 0 : 0.18,
    byGrade: detail ? byGrade : null
  };
}

export function applySurvey(s: RunState, tier: SurveyTier, plotRoute?: boolean): RunState {
  const spec = CFG.SURVEY[tier];
  if (!spec || spec.cost === 0) return s;
  s.survey = tier; s.surveyCost = spec.cost;
  // Unattended runs get the survey PLOTTED as waypoints — that is what buying an
  // autopilot service means. A pilot gets the same file as a summary and flies blind.
  if (!plotRoute) { s.log.push({ n: ++s.step, t: `${spec.label.toLowerCase()} survey filed`, c: 0, k: 'ping' }); return s; }
  const rng = mulberry32(s.seed * 2654435761 + 17);
  for (const g of oreClusters(s)) {
    s.contacts.push({
      key: `${Math.round(g.cx * 2)}:${Math.round(g.cy * 2)}`,
      x: g.cx + (rng() * 2 - 1) * spec.blur,
      y: g.cy + (rng() * 2 - 1) * spec.blur,
      tx: g.cx, ty: g.cy,
      blur: spec.blur, fixes: 1, mass: g.mass, tier: g.tier,
      lo: 1, hi: 4, survey: true      // grade unknown: the full range
    });
  }
  s.log.push({ n: ++s.step, t: `${spec.label.toLowerCase()} survey · ${s.contacts.length} pockets`, c: 0, k: 'ping' });
  return s;
}

export function createRun(seed: number, chassis: Chassis, energy?: number): RunState {
  const dims = fieldDims();
  CFG.W = dims.W; CFG.H = dims.H;   // prototype: field dims are global per run
  const f = generateField(seed);
  const claim = energy ?? CFG.ENERGY;
  return {
    seed, chassis,
    cells: f.cells, base: f.base,
    x: f.base.x, y: f.base.y,
    dir: null,
    fuel: chassis.fuelCap,
    sink: chassis.sinkCap,
    energy: claim,
    carrying: [],          // {tier, units}
    banked: [],
    fuelUsed: 0,
    sinkLost: 0,
    trip: 1,
    refuels: 0,
    survey: 'none',
    surveyCost: 0,
    claimCost: CFG.CLAIM_COST[claim] ?? 0,
    contacts: [],        // fuzzy sensor returns, sharpened by repeat pings
    pings: 0,
    pingReady: 0,        // step index when the next ping is allowed
    bearing: null,       // direction of the strongest return beyond range
    seen: new Set(),     // cells the pilot has actually cut or stood beside
    energyStart: claim,
    log: [],
    status: 'active',      // active | banked | stranded | wrecked
    step: 0
  };
}

const clone = (s: RunState): RunState => ({
  ...s,
  cells: s.cells.map(c => ({ ...c })),
  carrying: s.carrying.map(o => ({ ...o })),
  banked: s.banked.map(o => ({ ...o })),
  log: s.log.slice(),
  contacts: s.contacts.map(c => ({ ...c })),
  seen: new Set(s.seen)
});

export const heldUnits = (s: RunState) => s.carrying.reduce((n, o) => n + o.units, 0);
export const moveCost  = (s: RunState) => 1 / s.chassis.speed;
export const turnCost  = (s: RunState) => CFG.TURN_BASE / s.chassis.movement;
export const cellAt    = (s: RunState, x: number, y: number) => s.cells[idx(x, y)];
export const atBase    = (s: RunState) => s.x === s.base.x && s.y === s.base.y;

// fuel to enter a cell, accounting for whether it's already tunnelled
function stepCost(s: RunState, nx: number, ny: number, turned: boolean): number {
  const c = cellAt(s, nx, ny);
  if (c.seam) return Infinity;
  let cost = c.dug ? moveCost(s) * CFG.TUNNEL_MULT : moveCost(s) + CFG.DIG_FUEL;
  if (turned) cost += turnCost(s);
  return cost;
}

// Walk an L-shaped route and sum real costs — tunnels make going home cheap.
// This is an ESTIMATE, so a hard seam on the straight line is priced as a detour
// rather than as impassable. Returning Infinity here makes the baseline believe
// it can never get home, which strands it.
function pathCost(s: RunState, fx: number, fy: number, tx: number, ty: number, startDir?: DirKey | null): number {
  let cost = 0, cx = fx, cy = fy, dir: DirKey | null = startDir ?? null, guard = 0;
  while ((cx !== tx || cy !== ty) && guard++ < 400) {
    const nd: DirKey = cx !== tx ? (tx > cx ? 'E' : 'W') : (ty > cy ? 'S' : 'N');
    const d = DIRS[nd]; cx += d[0]; cy += d[1];
    const c = cellAt(s, cx, cy);
    if (c.seam) {
      cost += 2.2 * (moveCost(s) + CFG.DIG_FUEL) + turnCost(s);   // go around
    } else {
      cost += stepCost(s, cx, cy, dir !== null && dir !== nd);
    }
    dir = nd;
  }
  return cost;
}

// True cost-to-base for every cell, by Dijkstra over the real grid. The L-shaped
// estimate above is fine for ranking targets, but the baseline needs an accurate
// number to decide when to turn for home — a wrong estimate either strands it or
// makes it quit with fuel still in the tank.
function costMapFrom(s: RunState, sx: number, sy: number, avoidHazard: boolean): Float64Array {
  const N = CFG.W * CFG.H;
  const dist = new Float64Array(N).fill(Infinity);
  const turnAllow = turnCost(s) * 0.45;      // amortised: not every step turns
  const start = idx(sx, sy);
  dist[start] = 0;
  const q: number[] = [start];
  while (q.length) {
    let bi = 0;
    for (let i = 1; i < q.length; i++) if (dist[q[i]] < dist[q[bi]]) bi = i;
    const cur = q.splice(bi, 1)[0];
    const cx = cur % CFG.W, cy = (cur - cx) / CFG.W;
    for (const k of Object.keys(DIRS) as DirKey[]) {
      const nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
      if (!inBounds(nx, ny)) continue;
      const c = cellAt(s, nx, ny);
      if (c.seam) continue;
      let step = (c.dug ? moveCost(s) * CFG.TUNNEL_MULT : moveCost(s) + CFG.DIG_FUEL) + turnAllow;
      if (avoidHazard && c.known && c.hazard > 0) {
        if (s.sink - c.hazard <= 0) continue;            // never route through death
        step += c.hazard * 0.9;                          // otherwise merely expensive
      }
      const nd = dist[cur] + step;
      const ni = idx(nx, ny);
      if (nd < dist[ni] - 1e-9) { dist[ni] = nd; q.push(ni); }
    }
  }
  return dist;
}

const homeCosts = (s: RunState) => costMapFrom(s, s.base.x, s.base.y, false);

export function returnCost(s: RunState, x: number, y: number): number {
  if (!s._home || s._homeStep !== s.step) { s._home = homeCosts(s); s._homeStep = s.step; }
  const d = s._home[idx(x, y)];
  return isFinite(d) ? d : pathCost(s, x, y, s.base.x, s.base.y, s.dir);
}

export const DIRS: Record<DirKey, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

export function applyMove(state: RunState, dirKey: DirKey): ApplyResult {
  const s = clone(state);
  if (s.status !== 'active') return { s, err: 'run over' };
  const d = DIRS[dirKey];
  const nx = s.x + d[0], ny = s.y + d[1];
  if (!inBounds(nx, ny)) return { s, err: 'edge of field' };
  const tgt = cellAt(s, nx, ny);
  if (tgt.seam) {
    tgt.known = true;
    s.log.push({ n: ++s.step, t: `${dirKey} blocked — hard seam`, c: 0, k: 'bad' });
    return { s, err: 'undiggable seam' };
  }

  const turned = s.dir !== null && s.dir !== dirKey;
  const fresh = !cellAt(s, nx, ny).dug;
  const cost = stepCost(s, nx, ny, turned);

  if (s.fuel < cost) {
    s.fuel = 0;
    s.status = atBase(s) ? 'banked' : 'stranded';
    s.log.push({ n: ++s.step, t: 'fuel dry', c: 0, k: 'bad' });
    return { s };
  }

  s.fuel -= cost; s.fuelUsed += cost;
  s.x = nx; s.y = ny; s.dir = dirKey;

  const cell = cellAt(s, nx, ny);
  const hadHazard = cell.hazard > 0 && fresh;
  cell.dug = true; cell.known = true;
  for (const k of Object.keys(DIRS) as DirKey[]) {                      // you can see the faces around you
    const ax = nx + DIRS[k][0], ay = ny + DIRS[k][1];
    if (inBounds(ax, ay)) cellAt(s, ax, ay).known = true;
  }
  let note = `${cell.cavern ? 'cavern' : fresh ? 'dig' : 'tunnel'} ${dirKey}${turned ? ' ·turn' : ''}`;
  if (hadHazard) {
    if (cell.gas) note = `GAS ${dirKey}`;
    s.sink -= cell.hazard; s.sinkLost += cell.hazard;
    note += ` · hazard ${cell.hazard}`;
    if (s.sink <= 0) {
      s.sink = 0;
      s.status = 'wrecked';
      s.log.push({ n: ++s.step, t: note, c: cost, k: 'bad' });
      return { s };
    }
  }
  pruneContacts(s);
  s.log.push({ n: ++s.step, t: note, c: cost, k: cell.hazard > 0 ? 'bad' : (fresh ? '' : 'tun') });

  if (atBase(s)) unloadInto(s);
  return { s };
}

function unloadInto(s: RunState): void {
  if (s.carrying.length === 0) return;
  const u = heldUnits(s);
  s.banked.push(...s.carrying);
  s.carrying = [];
  s.trip++;
  s.log.push({ n: ++s.step, t: `unload ${u}u · haul ${s.trip}`, c: 0, k: 'good' });
}

export function applyExtract(state: RunState): ApplyResult {
  const s = clone(state);
  if (s.status !== 'active') return { s, err: 'run over' };
  const cell = cellAt(s, s.x, s.y);
  if (cell.tier === 0 || cell.spent) return { s, err: 'nothing here' };

  const room = s.chassis.hold - heldUnits(s);
  const take = Math.min(cell.units, room, s.energy);
  if (take <= 0) return { s, err: room <= 0 ? 'hold full' : 'out of energy' };
  if (s.fuel < CFG.EXTRACT_FUEL) return { s, err: 'not enough fuel to cut' };

  s.fuel -= CFG.EXTRACT_FUEL; s.fuelUsed += CFG.EXTRACT_FUEL;
  s.energy -= take;
  cell.units -= take;
  if (cell.units <= 0) { cell.spent = true; cell.tier_kept = cell.tier; }
  s.carrying.push({ tier: cell.tier, units: take });
  s.log.push({ n: ++s.step, t: `cut ${take}u g${cell.tier}`, c: CFG.EXTRACT_FUEL, k: 'ex' });
  if (cell.units <= 0) cell.tier = 0;
  pruneContacts(s);
  return { s };
}

/* --- Sensors ----------------------------------------------------------------
   A ping detects METAL, not terrain. It never reveals rock, seams, gas or
   caverns — those are only ever learned by cutting into them. Returns come back
   blurred; repeat pings from a different bearing triangulate them sharper.
---------------------------------------------------------------------------- */

export function oreClusters(s: RunState): OreCluster[] {
  // group adjacent ore cells into contacts, so one pocket reads as one return
  const seen = new Set<number>(), out: OreCluster[] = [];
  for (const c of s.cells) {
    if (c.tier === 0 || c.spent || seen.has(idx(c.x, c.y))) continue;
    const stack = [c], group: Cell[] = [];
    seen.add(idx(c.x, c.y));
    while (stack.length) {
      const n = stack.pop()!; group.push(n);
      for (const k of Object.keys(DIRS) as DirKey[]) {
        const nx = n.x + DIRS[k][0], ny = n.y + DIRS[k][1];
        if (!inBounds(nx, ny)) continue;
        const m = cellAt(s, nx, ny);
        if (m.tier === 0 || m.spent || seen.has(idx(nx, ny))) continue;
        seen.add(idx(nx, ny)); stack.push(m);
      }
    }
    const mass = group.reduce((n, g) => n + g.units, 0);
    const cx = group.reduce((n, g) => n + g.x, 0) / group.length;
    const cy = group.reduce((n, g) => n + g.y, 0) / group.length;
    const tier = Math.round(group.reduce((n, g) => n + g.tier * g.units, 0) / mass);
    out.push({ cx, cy, mass, tier, cells: group.length });
  }
  return out;
}

export function applyPing(state: RunState): ApplyResult {
  const s = clone(state);
  if (s.status !== 'active') return { s, err: 'run over' };
  if (s.step < s.pingReady) return { s, err: `sensors recharging (${s.pingReady - s.step} moves)` };
  const cost = s.chassis.pingFuel;
  if (s.fuel < cost) return { s, err: 'not enough fuel to ping' };

  s.fuel -= cost; s.fuelUsed += cost; s.pings++;
  const rng = mulberry32(s.seed * 7919 + s.pings * 104729 + idx(s.x, s.y));
  const R = s.chassis.sensorRange;
  const groups = oreClusters(s);
  let best: OreCluster | null = null, bestScore = 0, found = 0;

  for (const g of groups) {
    const dist = Math.hypot(g.cx - s.x, g.cy - s.y);
    if (dist > R) {
      const sc = g.mass / (dist * dist + 1);
      if (sc > bestScore) { bestScore = sc; best = g; }
      continue;
    }
    found++;
    // blur shrinks with sensor quality and with proximity
    const blur = s.chassis.sensorBlur * (0.35 + 0.65 * (dist / R));
    const key = `${Math.round(g.cx * 2)}:${Math.round(g.cy * 2)}`;
    let ex = s.contacts.find(c => c.key === key);
    const ox = g.cx + (rng() * 2 - 1) * blur, oy = g.cy + (rng() * 2 - 1) * blur;
    if (ex) {
      // triangulation: average the fixes, weighted toward the sharper one.
      // A survey fix is a weak prior — the first real ping should dominate it.
      if (ex.survey) { ex.fixes = 0; ex.survey = false; }
      const w = 1 / (blur + 0.2), wOld = 1 / (ex.blur + 0.2);
      ex.x = (ex.x * wOld + ox * w) / (wOld + w);
      ex.y = (ex.y * wOld + oy * w) / (wOld + w);
      ex.blur = 1 / (wOld + w);
      ex.fixes++;
    } else {
      s.contacts.push({ key, x: ox, y: oy, tx: g.cx, ty: g.cy, blur, fixes: 1, mass: g.mass, tier: g.tier });
      ex = s.contacts[s.contacts.length - 1];
    }
    // mass reads honestly; grade only ever comes back as a range
    ex.mass = g.mass;
    const width = Math.max(0.5, s.chassis.analyser / Math.sqrt(ex.fixes));
    ex.lo = Math.max(1, Math.round(g.tier - width / 2));
    ex.hi = Math.min(4, Math.round(g.tier + width / 2));
    if (ex.lo > ex.hi) ex.hi = ex.lo;
  }

  s.bearing = best
    ? { dir: bearingOf(best.cx - s.x, best.cy - s.y), mass: best.mass }
    : null;
  pruneContacts(s);
  s.pingReady = s.step + CFG.PING_COOLDOWN;
  s.log.push({ n: ++s.step, t: `ping · ${found} contact${found === 1 ? '' : 's'}${s.bearing ? ' + bearing' : ''}`, c: cost, k: 'ping' });
  return { s };
}

// A contact exists to point at ore you cannot see. The moment you can see it —
// or there is nothing left of it — the marker is noise and retires itself.
function contactResolved(s: RunState, k: Contact): boolean {
  let anyLeft = false;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = Math.round(k.tx + dx), y = Math.round(k.ty + dy);
      if (!inBounds(x, y)) continue;
      const c = cellAt(s, x, y);
      if (c.tier > 0 && !c.spent) {
        anyLeft = true;
        if (c.known) return true;
      }
    }
  }
  return !anyLeft;
}

const pruneContacts = (s: RunState) => { s.contacts = s.contacts.filter(k => !contactResolved(s, k)); };

function bearingOf(dx: number, dy: number): string {
  const a = Math.atan2(dy, dx) * 180 / Math.PI;
  const names = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  return names[(Math.round(a / 45) + 8) % 8];
}

export function applyEnd(state: RunState, force?: boolean): ApplyResult {
  const s = clone(state);
  if (!atBase(s) && !force) { return { s, err: 'must be at base' }; }
  if (!atBase(s)) { s.status = 'stranded'; s.log.push({ n: ++s.step, t: 'abandoned in field', c: 0, k: 'bad' }); return { s }; }
  unloadInto(s);
  s.status = 'banked';
  s.log.push({ n: ++s.step, t: 'run closed', c: 0, k: 'good' });
  return { s };
}

export function score(s: RunState): ScoreResult {
  const units = s.banked.reduce((n, o) => n + o.units, 0);
  const value = s.banked.reduce((n, o) => n + o.units * CFG.GRADE_VALUE[o.tier], 0);
  const revenue = value * CFG.ORE_PRICE;
  const fuelCost = s.fuelUsed * CFG.FUEL_PRICE;
  const repair  = s.sinkLost * CFG.REPAIR_PER_SINK;
  const cost = fuelCost + repair + CFG.LAUNCH_COST + (s.surveyCost || 0) + (s.claimCost || 0);
  return {
    units, value, revenue, fuelCost, repair, cost, launch: CFG.LAUNCH_COST,
    surveyCost: s.surveyCost || 0, claimCost: s.claimCost || 0, survey: s.survey,
    trips: s.trip,
    energyLeft: s.energy,
    energyUsed: s.energyStart - s.energy,
    claimSpent: s.energyStart ? (s.energyStart - s.energy) / s.energyStart : 0,
    net: revenue - cost,
    grade: units ? value / units : 0,
    costPerUnit: units ? cost / units : 0,
    margin: revenue ? cost / revenue : 0,
    lost: s.carrying.reduce((n, o) => n + o.units, 0),
    status: s.status
  };
}

/* ---- AI baseline: greedy, cautious, never stupid ------------------------- */
export function runAI(seed: number, chassis: Chassis, energy?: number): RunState {
  let s = createRun(seed, chassis, energy);
  s = applySurvey(s, CFG.AI_SURVEY, true);
  s = applyPing(s).s;
  // A committed goal. Re-deciding every step makes the baseline oscillate between
  // two equally-scored targets, burning turn cost until the tank runs dry.
  let goal: { x: number; y: number; kind: 'ore' | 'contact' | 'probe' } | null = null;
  const goalDead = (st: RunState) => !goal
    || (goal.x === st.x && goal.y === st.y)
    || (goal.kind === 'ore' && (() => { const c = cellAt(st, goal!.x, goal!.y); return c.tier === 0 || c.spent; })());
  let guard = 0, stall = 0, lastEnergy = s.energy;
  while (s.status === 'active' && guard++ < 6000) {
    // no ore lifted for a long stretch means the baseline is going nowhere
    const pos = idx(s.x, s.y);
    if (s.energy === lastEnergy) stall++; else stall = 0;
    lastEnergy = s.energy;
    const patience = CFG.W + CFG.H;
    if (stall > patience || guard > 5900) {
      if (atBase(s)) break;
      const home = stepHome(s);
      if (idx(home.x, home.y) === pos) { s = applyEnd(s, true).s; break; }
      s = home; stall = 0; goal = null; continue;
    }
    const room = chassis.hold - heldUnits(s);

    // day is done: claim spent, or too battered to keep cutting
    if (s.energy <= 0 || s.sink <= chassis.sinkCap * CFG.AI_SINK_STOP) {
      if (atBase(s)) break;
      s = stepHome(s); continue;
    }
    // hold full → haul it back to base (unloads on arrival, no refuel)
    if (room <= 0) {
      if (atBase(s)) break;              // couldn't unload; nothing more to do
      goal = null; s = stepHome(s); continue;
    }

    // pursue the committed goal before considering anything else
    if (!goalDead(s)) {
      const before = idx(s.x, s.y);
      const next = stepToward(s, goal!.x, goal!.y);
      if (idx(next.x, next.y) !== before || next.status !== 'active') { s = next; continue; }
      goal = null;                       // blocked; pick something else
    } else { goal = null; }
    const here = cellAt(s, s.x, s.y);
    if (here.tier > 0 && !here.spent && s.fuel > CFG.EXTRACT_FUEL + returnCost(s, s.x, s.y) * CFG.AI_SAFETY + CFG.AI_RESERVE) {
      const r = applyExtract(s);
      if (!r.err) { s = r.s; goal = null; continue; }
    }
    // blind and low on fuel: cut losses and bank what we have
    if (!atBase(s) && s.fuel < returnCost(s, s.x, s.y) * 1.20 + 3) { s = stepHome(s); continue; }
    let target = pickTarget(s, chassis);
    if (!target && s.step >= s.pingReady && s.fuel > chassis.pingFuel + returnCost(s, s.x, s.y) * 1.5) {
      const r = applyPing(s);
      if (!r.err) { s = r.s; target = pickTarget(s, chassis); }
    }
    if (target) { goal = { x: target.x, y: target.y, kind: 'ore' }; s = stepToward(s, goal.x, goal.y); continue; }
    {
      // head for the best contact the survey or a ping gave us
      const k = contactTarget(s, chassis);
      if (k && (k.x !== s.x || k.y !== s.y)) {
        goal = { x: k.x, y: k.y, kind: 'contact' };
        s = stepToward(s, goal.x, goal.y); continue;
      }
      // nothing detected: probe outward, but only with real fuel in hand
      if (s.fuel > returnCost(s, s.x, s.y) * 1.6 + 12 * (moveCost(s) + CFG.DIG_FUEL)) {
        const b = s.bearing ? s.bearing.dir : null;
        const dx = b && b.includes('E') ? 3 : b && b.includes('W') ? -3 : 2;
        const dy = b && b.includes('S') ? 3 : b && b.includes('N') ? -3 : 0;
        const tx = Math.max(0, Math.min(CFG.W - 1, s.x + dx));
        const ty = Math.max(0, Math.min(CFG.H - 1, s.y + dy));
        if (tx !== s.x || ty !== s.y) {
          goal = { x: tx, y: ty, kind: 'probe' };
          s = stepToward(s, tx, ty); continue;
        }
      }
      if (atBase(s)) break;
      goal = null; s = stepHome(s); continue;
    }
  }
  if (s.status === 'active') { s = applyEnd(s, true).s; }
  return s;
}

// The baseline can only act on what it has actually detected or cut into.
// It cannot see the field, which is why its grade is poor even when its
// tonnage is fine — exactly the gap a live pilot is paid to close.
function aiKnows(s: RunState, c: Cell): boolean {
  if (c.known) return true;
  for (const k of s.contacts) {
    if (Math.hypot(k.x - c.x, k.y - c.y) <= k.blur + 1.4) return true;
  }
  return false;
}

// The baseline drives toward its best unresolved contact — but only one it can
// actually reach and still get home from. A survey without this check just makes
// the autopilot strand itself further from base.
function contactTarget(s: RunState, chassis: Chassis): Point | null {
  let best: Point | null = null, bs = 0;
  for (const k of s.contacts) {
    const tx = Math.max(0, Math.min(CFG.W - 1, Math.round(k.x)));
    const ty = Math.max(0, Math.min(CFG.H - 1, Math.round(k.y)));
    if (cellAt(s, tx, ty).seam) continue;
    const reach = pathCost(s, s.x, s.y, tx, ty, s.dir);
    const home  = returnCost(s, tx, ty);
    if (s.fuel < (reach + home) * 1.20 + 4) continue;
    const take = Math.min(k.mass, chassis.hold);
    if (reach > chassis.fuelCap * CFG.AI_REACH * 1.4) continue;
    const gain = take * CFG.GRADE_VALUE[Math.max(1, k.tier)] * CFG.ORE_PRICE;
    const spend = reach * CFG.FUEL_PRICE;
    if (gain <= spend * CFG.AI_MARGIN) continue;
    const sc = take / (reach + 10);
    if (sc > bs) { bs = sc; best = { x: tx, y: ty }; }
  }
  return best;
}

function pickTarget(s: RunState, chassis: Chassis): Cell | null {
  let best: Cell | null = null, bestScore = 0;
  const room = chassis.hold - heldUnits(s);
  for (const c of s.cells) {
    if (c.tier === 0 || c.spent) continue;
    if (!aiKnows(s, c)) continue;
    const reach = pathCost(s, s.x, s.y, c.x, c.y, s.dir) + CFG.EXTRACT_FUEL;
    const home = pathCost(s, c.x, c.y, s.base.x, s.base.y, null);
    if (s.fuel < (reach + home) * CFG.AI_SAFETY + CFG.AI_RESERVE) continue;
    const thin = s.sink < chassis.sinkCap * 0.55;
    if (c.known && c.hazard > 0 && (thin || s.sink - c.hazard <= chassis.sinkCap * 0.30)) continue;
    const take = Math.min(c.units, room, s.energy);
    if (take <= 0) continue;
    // The baseline chases PROFIT per unit of fuel, and refuses anything that
    // doesn't clear its own cost. Optimising raw tonnage instead made it fill the
    // claim with grade-1 rock that cost more fuel than it was worth — the single
    // largest cause of losing runs. Dividing by reach keeps it lazy about distance,
    // so it still comes home with a mediocre manifest: near AND worth cutting,
    // never the best on the face.
    // Two independent gates, and they must stay independent:
    //   1. A PROFIT FLOOR so the baseline never cuts ore that loses money.
    //   2. A REACH CAP that ignores grade entirely.
    // A profit filter alone is secretly a grade-gated travel permit — grade 4 clears
    // it at long range, grade 1 clears it nowhere — so the baseline ends up
    // cherry-picking the best seams and closing the skill gap. The cap is what keeps
    // it local and lazy, which is the whole point of a baseline.
    if (reach > chassis.fuelCap * CFG.AI_REACH) continue;
    const gain = take * CFG.GRADE_VALUE[c.tier] * CFG.ORE_PRICE;
    const spend = (reach + CFG.EXTRACT_FUEL) * CFG.FUEL_PRICE;
    if (gain <= spend * CFG.AI_MARGIN) continue;
    const sc = take / (reach + 1);
    if (sc > bestScore) { bestScore = sc; best = c; }
  }
  return best;
}

// Shortest-path stepping. Greedy axis-first movement oscillates whenever a seam
// or hazard forces a sidestep — the rig steps aside, the axis reopens, it steps
// back, and it does that until the tank is empty. A cost map cannot do that.
function stepToward(s: RunState, tx: number, ty: number): RunState {
  if (s.x === tx && s.y === ty) return s;
  const dist = costMapFrom(s, tx, ty, true);
  let bestDir: DirKey | null = null, bestVal = Infinity;
  for (const k of Object.keys(DIRS) as DirKey[]) {
    const nx = s.x + DIRS[k][0], ny = s.y + DIRS[k][1];
    if (!inBounds(nx, ny)) continue;
    const c = cellAt(s, nx, ny);
    if (c.seam) continue;
    if (c.known && c.hazard > 0 && s.sink - c.hazard <= 0) continue;
    let v = dist[idx(nx, ny)];
    if (!isFinite(v)) continue;
    if (k !== s.dir && s.dir !== null) v += turnCost(s) * 0.5;   // prefer holding heading
    if (v < bestVal) { bestVal = v; bestDir = k; }
  }
  if (!bestDir) {
    const dead = clone(s);
    dead.status = atBase(dead) ? 'banked' : 'stranded';
    return dead;
  }
  const r = applyMove(s, bestDir);
  if (r.err || r.s.status === 'wrecked') {
    const dead = clone(s);
    dead.status = atBase(dead) ? 'banked' : 'stranded';
    return r.err ? dead : r.s;
  }
  return r.s;
}
export const stepHome = (s: RunState) => stepToward(s, s.base.x, s.base.y);
