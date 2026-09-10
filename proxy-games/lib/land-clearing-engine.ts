// Land-clearing run engine. Pure functions only — no DOM, no Math.random
// outside mulberry32, no Date.now — same convention as mining-engine.ts, so
// this is portable into a server context the same way.
//
// Different game, different shape: no fuel/cargo, no ore grades. A Proxy
// enters a walled parcel with 100 energy and has to fight down a wilderness
// that gets stronger the longer it's left alone (see the spawner
// maturation chain below), while grabbing whatever quick salvage a kill
// leaves behind. There is no channel-to-extract deposit mechanic — see
// app/design_docs/land-clearing-minigame.md's revision history; salvage is
// instant-on-pickup, not a multi-tick hold like mining's ore cells.

export type RunStatus = "active" | "cleared" | "extracted" | "depleted" | "destroyed";

// The stats an equipped land-clearing item can affect — see
// lib/land-clearing-inventory.ts and db/020_land_clearing_catalog.sql.
// 'speed' cheapens a move action, 'movement' widens it (tiles per action) —
// same split as mining's drive/steer, deliberately: a player who already
// knows that game reads this chassis the same way. 'attack', 'range', and
// 'aoeRadius' are NOT summed chassis-wide like the others — a chassis can
// carry several weapons at once (mounted in weapon-mount slots, a separate
// pool from the general gear slots — see db/022_weapon_mounts.sql), each
// keeping its own attack/range/aoeRadius rather than blending into one
// number; see `Chassis.weapons` and fight() below, which is where a
// specific equipped weapon is chosen for an attack.
export type StatKey =
  | "attack" | "armor" | "speed" | "movement" | "vision" | "salvageYield" | "range" | "aoeRadius";

// One equipped weapon's own stats. `range` here is already the resolved
// total (base melee reach + whatever the item adds) — see
// chassisFromEffects(), which is the only place that math happens.
// `aoeRadius` is 0 for an ordinary single-target weapon (melee or ranged);
// above 0, the weapon is fired at a tile (within `range` of the Proxy) and
// damages every entity within `aoeRadius` of THAT tile — see fight() below.
export interface Weapon {
  attack: number;
  range: number;
  aoeRadius: number;
}

export interface Chassis {
  weapons: Weapon[]; // always at least one — an unarmed baseline if nothing's equipped
  armor: number;
  speed: number;
  movement: number;
  vision: number;
  salvageYield: number;
}

export type EntityKind = "spawner" | "crawler" | "base" | "turret";

// `age` means something different per kind: for a crawler/base it's ticks
// since it was spawned (drives the maturation chain below); for a spawner
// it's ticks since its last emit (drives emit cadence); unused for turret.
export interface Entity {
  id: number;
  kind: EntityKind;
  x: number;
  y: number;
  hp: number;
  age: number;
}

export type PartCategory = "weapon" | "ranged" | "aoe" | "armor" | "drive" | "steer" | "sensor" | "salvage";
export type PartTier = 1 | 2 | 3 | 4;

export type LootDrop =
  | { kind: "scrap"; quantity: number }
  | { kind: "part"; category: PartCategory; tier: PartTier };

export interface Wreck {
  x: number;
  y: number;
  loot: LootDrop[];
}

export interface Cell {
  x: number;
  y: number;
  obstacle: boolean;
  // Fog of war: permanently true once it's ever been in vision range —
  // same "reveal and keep" simplification as mining-engine.ts's `seen`.
  seen: boolean;
}

export interface LogEntry {
  n: number; // step this happened on
  k: string; // event kind: 'emit' | 'mature' | 'resolve' | 'kill' | 'hit' | 'salvage' | 'extract' | 'depleted' | 'destroyed'
  msg: string;
}

export interface RunState {
  seed: number;
  chassis: Chassis;
  w: number;
  h: number;
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  energy: number;
  energyStart: number;
  cells: Cell[];
  entities: Entity[];
  wrecks: Wreck[];
  loot: LootDrop[]; // collected so far — banked at settle, see lib/land-clearing-run-store.ts
  nextEntityId: number;
  step: number;
  log: LogEntry[];
  status: RunStatus;
  // True once every wilderness entity is down — informational only, does
  // NOT end the run on its own (see advanceWilderness). Clearing a parcel
  // just means there's no more threat; the player still decides when to
  // leave, same as any other moment. extract() reads this to tell a
  // "cleared" ending from a merely "extracted" one.
  cleared: boolean;
}

// One sub-step of a turn, in the order it actually happened — the player's
// own action first, then whatever the wilderness did in response (see
// advanceWilderness()). This is what lets the client animate a turn as a
// sequence ("this crawler moved, then that turret fired") instead of just
// snapping straight to the resolved end state. Every event carries the
// acting thing's position (`x`,`y`) so the client can find and pulse the
// right marker without cross-referencing anything else.
export type WildernessEvent =
  | { kind: "player_move"; x: number; y: number; toX: number; toY: number }
  | { kind: "player_fight"; targetId: number; targetKind: EntityKind; x: number; y: number; damage: number; killed: boolean }
  | { kind: "player_salvage"; x: number; y: number }
  | { kind: "emit"; entityId: number; x: number; y: number; hp: number }
  | { kind: "crawler_move"; entityId: number; x: number; y: number; toX: number; toY: number }
  | { kind: "crawler_attack"; entityId: number; x: number; y: number; damage: number }
  | { kind: "mature"; entityId: number; x: number; y: number; hp: number }
  | { kind: "resolve_spawner"; entityId: number; x: number; y: number; hp: number }
  | { kind: "resolve_turret"; entityId: number; x: number; y: number; hp: number }
  | { kind: "turret_fire"; entityId: number; x: number; y: number; damage: number };

export interface ApplyResult {
  s: RunState;
  err?: string;
  events: WildernessEvent[];
}

export interface ScoreResult {
  scrap: number;
  parts: { category: PartCategory; tier: PartTier }[];
  kills: number;
  status: RunStatus;
}

/* ============================================================================
   TUNING CONSTANTS — everything balance-related lives here
   ========================================================================== */
export const CFG = {
  W: 12,
  H: 12,
  ENERGY_START: 100,

  BASE_ATTACK: 1,
  BASE_ARMOR: 0,
  BASE_SPEED: 0,
  BASE_MOVEMENT: 1,
  BASE_VISION: 2,
  BASE_SALVAGE_YIELD: 0,
  BASE_RANGE: 1, // melee reach with nothing equipped — see fight() below

  // Early read from a scripted playthrough: an unarmored chassis was
  // destroyed in 9 actions against 3 spawners — these are a first-pass
  // sanity baseline, not tuned balance. Tune directly, same as mining's CFG.
  HP_MAX: 30,

  // Second pass, from an actual playthrough: 100 energy barely covered
  // anything at the original 4/8/3 costs — a single bare-handed crawler
  // kill (4 hits at FIGHT_COST) was a third of the whole energy bar.
  // Halved across the board.
  MOVE_COST: 2,
  FIGHT_COST: 4,
  SALVAGE_COST: 2,

  OBSTACLE_DENSITY: 0.12,

  SPAWNER_COUNT: 2,
  SPAWNER_MIN_DIST_FROM_START: 4,
  SPAWNER_EMIT_INTERVAL: 4,

  // Spawner -> crawler -> (2 ticks) -> base -> (2 more ticks) -> resolves
  // into a new spawner (10%) or a turret (90%) — one turn longer than the
  // original 2+1 spec, per playthrough feedback that the chain was
  // resolving too fast to react to.
  CRAWLER_TO_BASE_AGE: 2,
  BASE_RESOLVE_AGE: 4,
  BASE_TO_SPAWNER_CHANCE: 0.1,

  SPAWNER_HP: 10,
  CRAWLER_HP: 4,
  CRAWLER_DAMAGE: 2,
  BASE_HP: 8,
  TURRET_HP: 6,
  TURRET_DAMAGE: 2,
  TURRET_RANGE: 3,

  SCRAP_MIN: 1,
  SCRAP_MAX: 3,
  PART_DROP_CHANCE: 0.35,
  // tier 1..4 — heavily weighted low, ~5% combined tier 3+4, per design
  // direction: "especially the lower elements should be weighted but
  // sometimes like 5% you get tier 3-4".
  PART_TIER_WEIGHTS: [0.7, 0.25, 0.04, 0.01] as const,
};

/* ============================================================================
   ENGINE — pure functions, no DOM, no Math.random, no Date.now
   ========================================================================== */

export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A single equipped weapon item's raw stats, as read straight off its
// item_catalog effects — `range` here is only the ADDITIONAL reach the
// item grants (0 for melee), not the resolved total; chassisFromEffects()
// below adds the base melee reach to get the real number.
export interface RawWeapon {
  attack: number;
  range: number;
  aoeRadius: number;
}

// A totally bare chassis is still weak but never non-functional — no
// divide-by-zero cost formula depends on any of these being nonzero (see
// moveCost()/fightCost() below), unlike mining's speed/movement floor. An
// unarmed chassis (rawWeapons empty) still gets exactly one weapon entry —
// a fists-only baseline — rather than an empty weapons list fight() would
// have nothing to select from.
export function chassisFromEffects(
  effects: Partial<Record<StatKey, number>>,
  rawWeapons: RawWeapon[] = [],
): Chassis {
  const e = (k: StatKey) => effects[k] ?? 0;
  const weapons: Weapon[] = rawWeapons.length
    ? rawWeapons.map((w) => ({ attack: w.attack, range: CFG.BASE_RANGE + w.range, aoeRadius: w.aoeRadius }))
    : [{ attack: CFG.BASE_ATTACK, range: CFG.BASE_RANGE, aoeRadius: 0 }];
  return {
    weapons,
    armor: CFG.BASE_ARMOR + e("armor"),
    speed: CFG.BASE_SPEED + e("speed"),
    movement: CFG.BASE_MOVEMENT + e("movement"),
    vision: CFG.BASE_VISION + e("vision"),
    salvageYield: CFG.BASE_SALVAGE_YIELD + e("salvageYield"),
  };
}

const idx = (x: number, y: number) => y * CFG.W + x;
const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < CFG.W && y < CFG.H;
const chebyshev = (ax: number, ay: number, bx: number, by: number) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

// Cost shrinks toward a floor as the stat rises — never free, never a
// divide-by-zero. 40% of base is the floor, matched to mining's own
// diminishing-returns feel without copying its exact curve.
function statCost(base: number, stat: number): number {
  return Math.max(base * 0.4, base * (1 - Math.min(0.6, stat)));
}

function moveCost(chassis: Chassis): number {
  return statCost(CFG.MOVE_COST, chassis.speed);
}

// For redaction (see lib/land-clearing-run-store.ts's toPublicView): a
// tile can be permanently `seen` (terrain, once revealed, stays known) but
// entities on it are only real information while it's *currently* in
// vision range — they move, so a stale sighting isn't trustworthy.
export function isVisibleNow(s: RunState, x: number, y: number): boolean {
  return chebyshev(x, y, s.x, s.y) <= s.chassis.vision;
}

function reveal(cells: Cell[], cx: number, cy: number, radius: number) {
  for (let y = Math.max(0, cy - radius); y <= Math.min(CFG.H - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(CFG.W - 1, cx + radius); x++) {
      if (chebyshev(x, y, cx, cy) <= radius) cells[idx(x, y)].seen = true;
    }
  }
}

function log(s: RunState, k: string, msg: string) {
  s.log.push({ n: s.step, k, msg });
}

function adjacentOpenTile(
  s: RunState,
  x: number,
  y: number,
  occupied: Set<string>,
): { x: number; y: number } | null {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      if (s.cells[idx(nx, ny)].obstacle) continue;
      if (occupied.has(`${nx},${ny}`)) continue;
      return { x: nx, y: ny };
    }
  }
  return null;
}

function rollPartTier(rng: () => number): PartTier {
  const weights = CFG.PART_TIER_WEIGHTS;
  const roll = rng();
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (roll < acc) return (i + 1) as PartTier;
  }
  return 1;
}

const PART_CATEGORIES: PartCategory[] = ["weapon", "ranged", "aoe", "armor", "drive", "steer", "sensor", "salvage"];

function rollLoot(rng: () => number, salvageYield: number): LootDrop[] {
  const loot: LootDrop[] = [
    { kind: "scrap", quantity: CFG.SCRAP_MIN + Math.floor(rng() * (CFG.SCRAP_MAX - CFG.SCRAP_MIN + 1)) },
  ];
  if (rng() < CFG.PART_DROP_CHANCE + salvageYield) {
    loot.push({
      kind: "part",
      category: PART_CATEGORIES[Math.floor(rng() * PART_CATEGORIES.length)],
      tier: rollPartTier(rng),
    });
  }
  return loot;
}

// Called once, at creation. `rng` is a fresh mulberry32(seed) — every other
// engine function takes a pre-seeded rng derived from `seed + step` so
// wilderness resolution stays deterministic and replayable from the log,
// the same guarantee mining's move_log/seed pair gives.
export function createRun(seed: number, chassis: Chassis): RunState {
  const rng = mulberry32(seed);
  const cells: Cell[] = [];
  for (let y = 0; y < CFG.H; y++) {
    for (let x = 0; x < CFG.W; x++) {
      cells.push({ x, y, obstacle: false, seen: false });
    }
  }

  const startX = 0;
  const startY = 0;
  for (const c of cells) {
    if (c.x === startX && c.y === startY) continue;
    if (rng() < CFG.OBSTACLE_DENSITY) c.obstacle = true;
  }

  const entities: Entity[] = [];
  let nextEntityId = 1;
  let placed = 0;
  let attempts = 0;
  while (placed < CFG.SPAWNER_COUNT && attempts < 500) {
    attempts++;
    const x = Math.floor(rng() * CFG.W);
    const y = Math.floor(rng() * CFG.H);
    const cell = cells[idx(x, y)];
    if (cell.obstacle) continue;
    if (chebyshev(x, y, startX, startY) < CFG.SPAWNER_MIN_DIST_FROM_START) continue;
    if (entities.some((e) => e.x === x && e.y === y)) continue;
    entities.push({ id: nextEntityId++, kind: "spawner", x, y, hp: CFG.SPAWNER_HP, age: 0 });
    placed++;
  }

  reveal(cells, startX, startY, chassis.vision);

  const s: RunState = {
    seed,
    chassis,
    w: CFG.W,
    h: CFG.H,
    x: startX,
    y: startY,
    hp: CFG.HP_MAX,
    hpMax: CFG.HP_MAX,
    energy: CFG.ENERGY_START,
    energyStart: CFG.ENERGY_START,
    cells,
    entities,
    wrecks: [],
    loot: [],
    nextEntityId,
    step: 0,
    log: [],
    status: "active",
    cleared: false,
  };
  return s;
}

// One wilderness tick: spawners emit, crawlers step toward the Proxy (or
// melee it if already adjacent) and age, bases sit and age, turrets shoot
// anything in range. Runs after every player action, regardless of that
// action's energy cost — see move()/fight()/salvage() below. Pushes both a
// textual LogEntry (the scrolling Log panel) and a structured
// WildernessEvent (animation replay) for everything that happens, in the
// same order they happen in — entities are iterated in array order, which
// is insertion order (oldest first), so this is a stable, replayable
// sequence, not an arbitrary one.
function advanceWilderness(s: RunState, events: WildernessEvent[]): void {
  const rng = mulberry32(s.seed + s.step * 2654435761);
  const occupied = new Set(s.entities.map((e) => `${e.x},${e.y}`));

  for (const e of s.entities) {
    if (e.kind === "spawner") {
      e.age++;
      if (e.age >= CFG.SPAWNER_EMIT_INTERVAL) {
        e.age = 0;
        const spot = adjacentOpenTile(s, e.x, e.y, occupied);
        if (spot) {
          const crawler: Entity = { id: s.nextEntityId++, kind: "crawler", x: spot.x, y: spot.y, hp: CFG.CRAWLER_HP, age: 0 };
          s.entities.push(crawler);
          occupied.add(`${spot.x},${spot.y}`);
          log(s, "emit", `A spawner released a crawler at (${spot.x}, ${spot.y}).`);
          events.push({ kind: "emit", entityId: crawler.id, x: spot.x, y: spot.y, hp: crawler.hp });
        }
      }
      continue;
    }

    if (e.kind === "crawler") {
      if (chebyshev(e.x, e.y, s.x, s.y) <= 1) {
        const damage = Math.max(1, CFG.CRAWLER_DAMAGE - s.chassis.armor);
        s.hp -= damage;
        log(s, "hit", `A crawler bit at your chassis for ${CFG.CRAWLER_DAMAGE} damage.`);
        events.push({ kind: "crawler_attack", entityId: e.id, x: e.x, y: e.y, damage });
      } else {
        const dx = Math.sign(s.x - e.x);
        const dy = Math.sign(s.y - e.y);
        const nx = e.x + dx, ny = e.y + dy;
        if (inBounds(nx, ny) && !s.cells[idx(nx, ny)].obstacle && !occupied.has(`${nx},${ny}`)) {
          occupied.delete(`${e.x},${e.y}`);
          const fromX = e.x, fromY = e.y;
          e.x = nx;
          e.y = ny;
          occupied.add(`${nx},${ny}`);
          events.push({ kind: "crawler_move", entityId: e.id, x: fromX, y: fromY, toX: nx, toY: ny });
        }
      }
      e.age++;
      if (e.age >= CFG.CRAWLER_TO_BASE_AGE) {
        e.kind = "base";
        e.hp = CFG.BASE_HP;
        log(s, "mature", `A crawler dug in and hardened into a base at (${e.x}, ${e.y}).`);
        events.push({ kind: "mature", entityId: e.id, x: e.x, y: e.y, hp: e.hp });
      }
      continue;
    }

    if (e.kind === "base") {
      e.age++;
      if (e.age >= CFG.BASE_RESOLVE_AGE) {
        if (rng() < CFG.BASE_TO_SPAWNER_CHANCE) {
          e.kind = "spawner";
          e.hp = CFG.SPAWNER_HP;
          e.age = 0;
          log(s, "resolve", `A base at (${e.x}, ${e.y}) grew into a new spawner.`);
          events.push({ kind: "resolve_spawner", entityId: e.id, x: e.x, y: e.y, hp: e.hp });
        } else {
          e.kind = "turret";
          e.hp = CFG.TURRET_HP;
          log(s, "resolve", `A base at (${e.x}, ${e.y}) armed itself into a turret.`);
          events.push({ kind: "resolve_turret", entityId: e.id, x: e.x, y: e.y, hp: e.hp });
        }
      }
      continue;
    }

    if (e.kind === "turret") {
      if (chebyshev(e.x, e.y, s.x, s.y) <= CFG.TURRET_RANGE) {
        const damage = Math.max(1, CFG.TURRET_DAMAGE - s.chassis.armor);
        s.hp -= damage;
        log(s, "hit", `A turret fired on your chassis for ${CFG.TURRET_DAMAGE} damage.`);
        events.push({ kind: "turret_fire", entityId: e.id, x: e.x, y: e.y, damage });
      }
    }
  }

  reveal(s.cells, s.x, s.y, s.chassis.vision);
  s.step++;

  // Clearing the parcel does NOT end the run by itself — it used to, which
  // meant the very wreck a final kill drops could never be salvaged (the
  // kill flips this to true, then the run would already be over before the
  // player's next action). It's just a fact about the parcel now; extract()
  // is what actually ends things, same as it always was.
  if (!s.cleared && s.entities.length === 0) {
    s.cleared = true;
    log(s, "cleared", "Parcel cleared — every wilderness threat is down. Extract whenever you're ready.");
  }

  if (s.hp <= 0) {
    s.hp = 0;
    s.status = "destroyed";
    log(s, "destroyed", "Your chassis went down. Whatever wasn't already banked is lost.");
  } else if (s.energy <= 0 && s.status === "active") {
    s.status = "depleted";
    log(s, "depleted", "Out of energy — the run ends here.");
  }
}

function clone(s: RunState): RunState {
  return {
    ...s,
    chassis: { ...s.chassis },
    cells: s.cells.map((c) => ({ ...c })),
    entities: s.entities.map((e) => ({ ...e })),
    wrecks: s.wrecks.map((w) => ({ x: w.x, y: w.y, loot: w.loot.map((l) => ({ ...l })) })),
    loot: s.loot.map((l) => ({ ...l })),
    log: [...s.log],
  };
}

function requireActive(s: RunState): string | undefined {
  if (s.status !== "active") return "run already ended";
  return undefined;
}

// One step in direction (dx, dy) — dx,dy each in {-1,0,1}, not both 0.
// Up to `movement` tiles are covered in that direction per action (stopping
// early at an obstacle, the edge, or an occupied tile) — but a player who
// can cover 2 doesn't have to spend both; `distance` (default: the full
// movement stat) caps how many of those tiles this particular action
// actually takes, same flat per-action cost either way, matching the
// "zigzags are one square, no turning cost" movement model from the design
// doc's revision notes.
export function move(state: RunState, dx: number, dy: number, distance?: number): ApplyResult {
  const s = clone(state);
  const blocked = requireActive(s);
  if (blocked) return { s, err: blocked, events: [] };
  if ((dx === 0 && dy === 0) || Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    return { s, err: "invalid direction", events: [] };
  }

  const cost = moveCost(s.chassis);
  if (s.energy < cost) return { s, err: "not enough energy", events: [] };

  const maxSteps = Math.max(1, Math.round(s.chassis.movement));
  const wantedSteps = distance != null ? Math.max(1, Math.min(Math.round(distance), maxSteps)) : maxSteps;

  const occupied = new Set(s.entities.map((e) => `${e.x},${e.y}`));
  let steps = 0;
  let cx = s.x, cy = s.y;
  for (let i = 0; i < wantedSteps; i++) {
    const nx = cx + dx, ny = cy + dy;
    if (!inBounds(nx, ny)) break;
    if (s.cells[idx(nx, ny)].obstacle) break;
    if (occupied.has(`${nx},${ny}`)) break;
    cx = nx;
    cy = ny;
    steps++;
  }
  if (steps === 0) return { s, err: "blocked", events: [] };

  const fromX = s.x, fromY = s.y;
  s.x = cx;
  s.y = cy;
  s.energy = Math.max(0, s.energy - cost);
  const events: WildernessEvent[] = [{ kind: "player_move", x: fromX, y: fromY, toX: cx, toY: cy }];
  advanceWilderness(s, events);
  return { s, events };
}

// Every tile the Proxy could move onto right now, one action, in a
// straight line in any of the 8 directions (stopping at the first
// obstacle/occupied tile/edge, same rule move() itself walks) — the set of
// valid click targets for the board's Move mode, and each tile's own
// distance is exactly the `distance` move() needs to reach it.
export interface ReachableTile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  distance: number;
}

export function reachableTiles(s: RunState): ReachableTile[] {
  const maxSteps = Math.max(1, Math.round(s.chassis.movement));
  const occupied = new Set(s.entities.map((e) => `${e.x},${e.y}`));
  const tiles: ReachableTile[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let cx = s.x, cy = s.y;
      for (let step = 1; step <= maxSteps; step++) {
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(nx, ny)) break;
        if (s.cells[idx(nx, ny)].obstacle) break;
        if (occupied.has(`${nx},${ny}`)) break;
        cx = nx;
        cy = ny;
        tiles.push({ x: cx, y: cy, dx, dy, distance: step });
      }
    }
  }
  return tiles;
}

// Applies one weapon's damage to one entity — mutates its hp directly (it's
// a reference into s.entities, from fight() below), and if that kills it,
// drops a wreck at its tile (see salvage() to actually collect it) and
// returns the WildernessEvent for that single hit. Shared by both branches
// of fight() so a single-target hit and one hit within an AoE blast are
// resolved identically.
function resolveHit(s: RunState, target: Entity, damage: number): WildernessEvent {
  target.hp -= damage;
  log(s, "hit", `You hit a ${target.kind} for ${damage}.`);
  const killed = target.hp <= 0;
  if (killed) {
    const rng = mulberry32(s.seed + s.step * 40503 + target.id);
    const loot = rollLoot(rng, s.chassis.salvageYield);
    s.wrecks.push({ x: target.x, y: target.y, loot });
    log(s, "kill", `Destroyed a ${target.kind} at (${target.x}, ${target.y}) — left a wreck.`);
  }
  return { kind: "player_fight", targetId: target.id, targetKind: target.kind, x: target.x, y: target.y, damage, killed };
}

// A single-target weapon takes `{ targetId }`; an AoE weapon (aoeRadius > 0)
// takes `{ x, y }` — the tile it's fired at, within `weapon.range` of the
// Proxy — and damages every entity within `aoeRadius` of that tile, not
// just one. No line-of-sight check for a ranged or AoE hit — obstacles
// don't block it, a deliberate first-pass simplification.
export type FightTarget = { targetId: number } | { x: number; y: number };

export function fight(state: RunState, weaponIndex: number, target: FightTarget): ApplyResult {
  const s = clone(state);
  const blocked = requireActive(s);
  if (blocked) return { s, err: blocked, events: [] };

  const weapon = s.chassis.weapons[weaponIndex];
  if (!weapon) return { s, err: "invalid weapon", events: [] };
  if (s.energy < CFG.FIGHT_COST) return { s, err: "not enough energy", events: [] };

  const damage = Math.max(1, Math.round(weapon.attack));
  const events: WildernessEvent[] = [];

  if (weapon.aoeRadius > 0) {
    if ("targetId" in target) return { s, err: "this weapon targets a tile, not an entity", events: [] };
    if (chebyshev(s.x, s.y, target.x, target.y) > weapon.range) return { s, err: "target out of reach", events: [] };

    const hits = s.entities.filter((e) => chebyshev(e.x, e.y, target.x, target.y) <= weapon.aoeRadius);
    if (hits.length === 0) return { s, err: "nothing in the blast radius", events: [] };

    s.energy = Math.max(0, s.energy - CFG.FIGHT_COST);
    const killedIds = new Set<number>();
    for (const hit of hits) {
      events.push(resolveHit(s, hit, damage));
      if (hit.hp <= 0) killedIds.add(hit.id);
    }
    s.entities = s.entities.filter((e) => !killedIds.has(e.id));
  } else {
    if (!("targetId" in target)) return { s, err: "this weapon needs a target", events: [] };
    const t = s.entities.find((e) => e.id === target.targetId);
    if (!t) return { s, err: "target not found", events: [] };
    if (chebyshev(s.x, s.y, t.x, t.y) > weapon.range) return { s, err: "target out of reach", events: [] };

    s.energy = Math.max(0, s.energy - CFG.FIGHT_COST);
    events.push(resolveHit(s, t, damage));
    if (t.hp <= 0) s.entities = s.entities.filter((e) => e.id !== t.id);
  }

  advanceWilderness(s, events);
  return { s, events };
}

// Collects whatever wreck is sitting on the Proxy's current tile. Instant,
// not a multi-tick channel — see the file header note on why land-clearing
// has no mining-style deposit mechanic.
export function salvage(state: RunState): ApplyResult {
  const s = clone(state);
  const blocked = requireActive(s);
  if (blocked) return { s, err: blocked, events: [] };

  const wreckIdx = s.wrecks.findIndex((w) => w.x === s.x && w.y === s.y);
  if (wreckIdx === -1) return { s, err: "nothing to salvage here", events: [] };

  if (s.energy < CFG.SALVAGE_COST) return { s, err: "not enough energy", events: [] };
  s.energy = Math.max(0, s.energy - CFG.SALVAGE_COST);

  const [wreck] = s.wrecks.splice(wreckIdx, 1);
  s.loot.push(...wreck.loot);
  log(s, "salvage", `Salvaged the wreck at (${s.x}, ${s.y}).`);

  const events: WildernessEvent[] = [{ kind: "player_salvage", x: s.x, y: s.y }];
  advanceWilderness(s, events);
  return { s, events };
}

// Voluntary early exit — banks whatever's in s.loot right now and ends the
// run, whether or not the parcel is actually clear.
// "cleared" vs "extracted" is decided here, not by the wilderness hitting
// zero entities — see the `cleared` flag's comment in advanceWilderness().
export function extract(state: RunState): ApplyResult {
  const s = clone(state);
  const blocked = requireActive(s);
  if (blocked) return { s, err: blocked, events: [] };
  s.status = s.cleared ? "cleared" : "extracted";
  log(s, "extract", s.cleared ? "Extracted with the parcel cleared." : "Extracted with whatever was salvaged.");
  return { s, events: [] };
}

// Tallies the run's loot for settlement — see lib/land-clearing-run-store.ts.
// A destroyed chassis loses everything not yet banked (there is nothing to
// bank — s.loot only ever holds what's already been salvaged, so this
// naturally returns whatever survives without any extra branching).
export function score(s: RunState): ScoreResult {
  let scrap = 0;
  const parts: { category: PartCategory; tier: PartTier }[] = [];
  for (const drop of s.loot) {
    if (drop.kind === "scrap") scrap += drop.quantity;
    else parts.push({ category: drop.category, tier: drop.tier });
  }
  const kills = s.log.filter((l) => l.k === "kill").length;
  return { scrap, parts, kills, status: s.status };
}
