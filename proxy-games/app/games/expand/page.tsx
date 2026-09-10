"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ATOMS } from "@/lib/mining-theme";

type EntityKind = "spawner" | "crawler" | "base" | "turret";
// Only move/attack are "modes" — a click-a-tile-to-target flow, since both
// have more than one possible destination. Salvage never does (there's
// only ever one valid tile: your own), so it isn't part of this — see the
// button row below, where it fires immediately instead of selecting a mode.
type Mode = "move" | "attack";

interface PublicEntity {
  id: number;
  kind: EntityKind;
  x: number;
  y: number;
  hp: number;
}
interface PublicCell {
  x: number;
  y: number;
  seen: boolean;
  obstacle: boolean;
}
interface Wreck {
  x: number;
  y: number;
  loot: unknown[];
}
interface LogEntry {
  n: number;
  k: string;
  msg: string;
}
// Mirrors lib/land-clearing-engine.ts's WildernessEvent — duplicated
// (type-only would be free to import, but the shape is small and this
// keeps the client fully decoupled from the engine module's own evolution)
// rather than imported, matching this file's existing convention of not
// reaching into the engine/DB-adjacent lib layer from a client component.
type WildernessEvent =
  | { kind: "player_move"; x: number; y: number; toX: number; toY: number }
  | {
      kind: "player_fight";
      targetId: number;
      targetKind: EntityKind;
      x: number;
      y: number;
      damage: number;
      killed: boolean;
    }
  | { kind: "player_salvage"; x: number; y: number }
  | { kind: "emit"; entityId: number; x: number; y: number; hp: number }
  | {
      kind: "crawler_move";
      entityId: number;
      x: number;
      y: number;
      toX: number;
      toY: number;
    }
  | {
      kind: "crawler_attack";
      entityId: number;
      x: number;
      y: number;
      damage: number;
    }
  | { kind: "mature"; entityId: number; x: number; y: number; hp: number }
  | {
      kind: "resolve_spawner";
      entityId: number;
      x: number;
      y: number;
      hp: number;
    }
  | {
      kind: "resolve_turret";
      entityId: number;
      x: number;
      y: number;
      hp: number;
    }
  | {
      kind: "turret_fire";
      entityId: number;
      x: number;
      y: number;
      damage: number;
    };

interface RunView {
  runId: string;
  w: number;
  h: number;
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  energy: number;
  energyStart: number;
  chassis: {
    weapons: { attack: number; range: number; aoeRadius: number }[];
    armor: number;
    speed: number;
    movement: number;
    vision: number;
    salvageYield: number;
  };
  loot: { kind: string; quantity?: number; category?: string; tier?: number }[];
  cells: PublicCell[];
  entities: PublicEntity[];
  wrecks: Wreck[];
  log: LogEntry[];
  status: "active" | "cleared" | "extracted" | "depleted" | "destroyed";
  step: number;
  cleared: boolean;
}

const ENTITY_COLOR: Record<EntityKind, string> = {
  spawner: "#D9564F",
  crawler: "#E8A93E",
  base: "#8F3FDF",
  turret: "#54C6DC",
};

const MODES: { mode: Mode; label: string }[] = [
  { mode: "move", label: "Move" },
  { mode: "attack", label: "Attack" },
];

// Every tile the Proxy could move onto in one action, in a straight line in
// any of the 8 directions — stops at the first obstacle/occupied
// tile/edge, same rule the server's move() itself walks (see
// reachableTiles() in lib/land-clearing-engine.ts, which this mirrors
// against the redacted view rather than importing — the public view's
// shape isn't the engine's full RunState).
function reachableFromView(
  view: RunView,
): Map<string, { dx: number; dy: number; distance: number }> {
  const maxSteps = Math.max(1, Math.round(view.chassis.movement));
  const occupied = new Set(view.entities.map((e) => `${e.x},${e.y}`));
  const cellByKey = new Map(view.cells.map((c) => [`${c.x},${c.y}`, c]));
  const tiles = new Map<string, { dx: number; dy: number; distance: number }>();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let cx = view.x,
        cy = view.y;
      for (let step = 1; step <= maxSteps; step++) {
        const nx = cx + dx,
          ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= view.w || ny >= view.h) break;
        const cell = cellByKey.get(`${nx},${ny}`);
        if (cell?.seen && cell.obstacle) break;
        if (occupied.has(`${nx},${ny}`)) break;
        cx = nx;
        cy = ny;
        tiles.set(`${cx},${cy}`, { dx, dy, distance: step });
      }
    }
  }
  return tiles;
}

export default function LandClearingPage() {
  const [phase, setPhase] = useState<"loading" | "fitting" | "active">(
    "loading",
  );
  const [runId, setRunId] = useState<string | null>(null);
  const [view, setView] = useState<RunView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settled, setSettled] = useState<{
    scrap: number;
    parts: unknown[];
    kills: number;
  } | null>(null);
  const [mode, setMode] = useState<Mode>("move");
  // Which of the chassis's mounted weapons is selected for the next attack
  // — a chassis can carry several (weapon mounts, see
  // db/022_weapon_mounts.sql), each with its own attack/range, and some
  // are AoE (target a tile, damage everything within aoeRadius of it)
  // rather than single-target (target one entity within range).
  const [selectedWeapon, setSelectedWeapon] = useState(0);
  // Which way the Proxy is currently facing — the engine has no concept of
  // facing (land-clearing movement is omnidirectional per action, unlike
  // mining's turn-cost model), so this is purely a client-side cursor cue,
  // set to whatever direction was last moved and left alone otherwise
  // (fighting/salvaging in place doesn't change it).
  const [facing, setFacing] = useState<{ dx: number; dy: number }>({
    dx: 0,
    dy: -1,
  });
  // Which tile is "acting" right now during a turn's replay (see
  // playEvents below), and whether that's a hit (tinted pulse) or
  // something neutral (plain pulse) — only this marker animates, so a turn
  // reads as a sequence of individual things happening rather than
  // everything flashing at once.
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [actingIsAttack, setActingIsAttack] = useState(false);
  // Bumped on every replay step so the acting marker's React key changes
  // even when the same tile acts twice in a row — a CSS animation on an
  // element that never remounts won't replay on its own. State, not a ref:
  // it's read during render (for the key), and a ref can't be.
  const [pulseToken, setPulseToken] = useState(0);
  // A turret's shot, currently traveling from its tile to the Proxy's —
  // see the shoot-travel keyframes in app/globals.css. Cleared between
  // events so a shot never lingers into an unrelated later frame.
  const [shot, setShot] = useState<{
    id: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null>(null);
  const shotIdRef = useRef(0);

  const bootRef = useRef(false);
  const boot = useCallback(async () => {
    const res = await fetch("/api/expand/runs/current", { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    setRunId(data.runId);
    if (data.phase === "active") {
      setView(data.view);
      setPhase("active");
    } else {
      setPhase("fitting");
    }
  }, []);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    boot();
  }, [boot]);

  async function launch() {
    if (!runId) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/expand/runs/${runId}/launch`, {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not launch — try again.");
      return;
    }
    const data = await res.json();
    setView(data);
    setPhase("active");
  }

  // Steps through a turn's events one at a time (see WildernessEvent above)
  // instead of jumping straight to the server's final, authoritative view —
  // this is what actually gives per-entity sequencing: the player's own
  // action first, then whichever wilderness entities reacted, in the exact
  // order they did on the server. Reconstructs positions/hp/entities/wrecks
  // incrementally from `view` (the pre-action state still on screen) as
  // each event plays; fog (`cells`) adopts the final view immediately,
  // since newly-revealed terrain doesn't need its own animation. Always
  // ends by snapping to `finalView` so any reconstruction drift self-heals.
  async function playEvents(events: WildernessEvent[], finalView: RunView) {
    let entities = view ? [...view.entities] : [];
    let wrecks = view ? [...view.wrecks] : [];
    let x = view?.x ?? finalView.x;
    let y = view?.y ?? finalView.y;
    let hp = view?.hp ?? finalView.hp;

    for (const ev of events) {
      switch (ev.kind) {
        case "player_move":
          x = ev.toX;
          y = ev.toY;
          setFacing({
            dx: Math.sign(ev.toX - ev.x) || 0,
            dy: Math.sign(ev.toY - ev.y) || 0,
          });
          break;
        case "player_fight":
          entities = ev.killed
            ? entities.filter((e) => e.id !== ev.targetId)
            : entities.map((e) =>
                e.id === ev.targetId ? { ...e, hp: e.hp - ev.damage } : e,
              );
          if (ev.killed) wrecks = [...wrecks, { x: ev.x, y: ev.y, loot: [] }];
          break;
        case "player_salvage":
          wrecks = wrecks.filter((w) => !(w.x === ev.x && w.y === ev.y));
          break;
        case "emit":
          entities = [
            ...entities,
            { id: ev.entityId, kind: "crawler", x: ev.x, y: ev.y, hp: ev.hp },
          ];
          break;
        case "crawler_move":
          entities = entities.map((e) =>
            e.id === ev.entityId ? { ...e, x: ev.toX, y: ev.toY } : e,
          );
          break;
        case "crawler_attack":
          hp -= ev.damage;
          break;
        case "turret_fire":
          hp -= ev.damage;
          shotIdRef.current++;
          setShot({
            id: shotIdRef.current,
            fromX: ev.x,
            fromY: ev.y,
            toX: x,
            toY: y,
          });
          break;
        case "mature":
          entities = entities.map((e) =>
            e.id === ev.entityId
              ? { ...e, kind: "base" as const, hp: ev.hp }
              : e,
          );
          break;
        case "resolve_spawner":
          entities = entities.map((e) =>
            e.id === ev.entityId
              ? { ...e, kind: "spawner" as const, hp: ev.hp }
              : e,
          );
          break;
        case "resolve_turret":
          entities = entities.map((e) =>
            e.id === ev.entityId
              ? { ...e, kind: "turret" as const, hp: ev.hp }
              : e,
          );
          break;
      }

      const actX = "toX" in ev ? ev.toX : ev.x;
      const actY = "toY" in ev ? ev.toY : ev.y;
      const isAttack =
        ev.kind === "player_fight" ||
        ev.kind === "crawler_attack" ||
        ev.kind === "turret_fire";
      setPulseToken((t) => t + 1);
      setActingKey(`${actX},${actY}`);
      setActingIsAttack(isAttack);
      setView({
        ...finalView,
        entities: [...entities],
        wrecks: [...wrecks],
        x,
        y,
        hp,
      });
      await new Promise((resolve) => setTimeout(resolve, 320));
      if (ev.kind === "turret_fire") setShot(null);
    }

    setActingKey(null);
    setView(finalView);
  }

  async function act(
    path: "move" | "fight" | "salvage" | "extract",
    body?: object,
  ) {
    if (!runId || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/expand/runs/${runId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      setBusy(false);
      setError("Request failed — try again.");
      return;
    }
    const data = await res.json();
    if (data.err) {
      setBusy(false);
      setError(data.err);
      return;
    }
    const events: WildernessEvent[] = data.events ?? [];
    if (events.length === 0) {
      setView(data.view ?? data);
    } else {
      await playEvents(events, data.view ?? data);
    }
    setBusy(false);
  }

  async function settle() {
    if (!runId) return;
    setBusy(true);
    const res = await fetch(`/api/expand/runs/${runId}/settle`, {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not settle run — try again.");
      return;
    }
    const data = await res.json();
    setSettled(data);
  }

  async function startNewParcel() {
    setSettled(null);
    setView(null);
    setRunId(null);
    setPhase("loading");
    bootRef.current = false;
    await boot();
  }

  const reachable = useMemo(
    () => (view && mode === "move" ? reachableFromView(view) : new Map()),
    [view, mode],
  );
  const activeWeapon =
    view?.chassis.weapons[selectedWeapon] ?? view?.chassis.weapons[0];
  const isAoeWeapon = (activeWeapon?.aoeRadius ?? 0) > 0;

  // Single-target weapon: which entities it can actually hit right now.
  const attackableEntities = useMemo(
    () =>
      view && activeWeapon && !isAoeWeapon
        ? view.entities.filter(
            (e) =>
              Math.max(Math.abs(e.x - view.x), Math.abs(e.y - view.y)) <=
              activeWeapon.range,
          )
        : [],
    [view, activeWeapon, isAoeWeapon],
  );
  // AoE weapon: every tile it could fire at (the blast center) — doesn't
  // need to be occupied, unlike a single-target attack.
  const aoeTargetTiles = useMemo(() => {
    const tiles = new Set<string>();
    if (!view || !activeWeapon || !isAoeWeapon) return tiles;
    for (let y = 0; y < view.h; y++) {
      for (let x = 0; x < view.w; x++) {
        if (
          Math.max(Math.abs(x - view.x), Math.abs(y - view.y)) <=
          activeWeapon.range
        )
          tiles.add(`${x},${y}`);
      }
    }
    return tiles;
  }, [view, activeWeapon, isAoeWeapon]);
  const wreckHere = useMemo(
    () => view?.wrecks.find((w) => w.x === view.x && w.y === view.y),
    [view],
  );

  function clickCell(x: number, y: number) {
    if (!view || busy) return;
    if (mode === "move") {
      const target = reachable.get(`${x},${y}`);
      if (!target) return;
      setFacing({ dx: target.dx, dy: target.dy });
      act("move", { dx: target.dx, dy: target.dy, distance: target.distance });
      return;
    }
    if (mode === "attack") {
      if (isAoeWeapon) {
        if (!aoeTargetTiles.has(`${x},${y}`)) return;
        act("fight", { weapon_index: selectedWeapon, x, y });
        return;
      }
      const target = attackableEntities.find((e) => e.x === x && e.y === y);
      if (!target) return;
      act("fight", { weapon_index: selectedWeapon, target_id: target.id });
    }
  }

  if (phase === "loading") {
    return (
      <div className={`mx-auto max-w-3xl px-6 py-12 ${ATOMS.textDim}`}>
        Loading…
      </div>
    );
  }

  if (phase === "fitting") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className={`mb-4 text-2xl font-bold ${ATOMS.textPrimary}`}>
          Unclaimed Parcel
        </h1>
        <p className={`mb-6 ${ATOMS.textDim}`}>
          Wilderness left alone only gets stronger — every action ticks its
          maturation clock. Check your fit at{" "}
          <a href="/games/expand/build" className={ATOMS.textTeal}>
            build
          </a>{" "}
          before you go in.
        </p>
        {error && <p className={`mb-4 ${ATOMS.textDanger}`}>{error}</p>}
        <button
          onClick={launch}
          disabled={busy}
          className="rounded bg-cyan-600 px-5 py-2.5 font-semibold text-slate-950 disabled:opacity-50"
        >
          Enter parcel
        </button>
      </div>
    );
  }

  if (!view) return null;

  if (view.status !== "active") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className={`mb-4 text-2xl font-bold ${ATOMS.textPrimary}`}>
          {view.status === "cleared" && "Parcel cleared"}
          {view.status === "extracted" && "Extracted"}
          {view.status === "depleted" && "Out of energy"}
          {view.status === "destroyed" && "Chassis destroyed"}
        </h1>
        <p className={`mb-6 ${ATOMS.textDim}`}>
          {view.loot.length} salvaged item{view.loot.length === 1 ? "" : "s"}{" "}
          pending settlement.
        </p>
        {error && <p className={`mb-4 ${ATOMS.textDanger}`}>{error}</p>}
        {!settled ? (
          <button
            onClick={settle}
            disabled={busy}
            className="rounded bg-cyan-600 px-5 py-2.5 font-semibold text-slate-950 disabled:opacity-50"
          >
            Settle run
          </button>
        ) : (
          <div>
            <p className={`mb-4 ${ATOMS.textPrimary}`}>
              Banked: {settled.scrap} scrap, {settled.parts.length} part
              {settled.parts.length === 1 ? "" : "s"}, {settled.kills} kill
              {settled.kills === 1 ? "" : "s"}.
            </p>
            <button
              onClick={startNewParcel}
              className="rounded bg-cyan-600 px-5 py-2.5 font-semibold text-slate-950"
            >
              New parcel
            </button>
          </div>
        )}
      </div>
    );
  }

  const cellByKey = new Map(view.cells.map((c) => [`${c.x},${c.y}`, c]));
  const entityByKey = new Map(view.entities.map((e) => [`${e.x},${e.y}`, e]));
  const cellSize = Math.max(
    16,
    Math.min(28, Math.floor(560 / Math.max(view.w, view.h))),
  );

  const modeHint: Record<Mode, string> = {
    move: reachable.size
      ? "Click a highlighted tile to move there."
      : "Nowhere to move.",
    attack: isAoeWeapon
      ? "Click a highlighted tile to fire — everything in the blast radius takes damage."
      : attackableEntities.length
        ? "Click a highlighted target to attack."
        : "Nothing in reach with this weapon.",
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {error && <p className={`mb-3 text-sm ${ATOMS.textDanger}`}>{error}</p>}
      {view.cleared && (
        <p className="mb-3 text-sm text-amber-400">
          Parcel cleared — nothing left out there. Extract whenever you&rsquo;re
          ready.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-6 text-sm">
        <div>
          <span className={ATOMS.textDim}>Turn </span>
          <span className={ATOMS.textPrimary}>{view.step}</span>
        </div>
        <div>
          <span className={ATOMS.textDim}>Energy </span>
          <span className={ATOMS.textPrimary}>
            {view.energy.toFixed(0)} / {view.energyStart}
          </span>
        </div>
        <div>
          <span className={ATOMS.textDim}>HP </span>
          <span className={ATOMS.textPrimary}>
            {view.hp} / {view.hpMax}
          </span>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        {MODES.map(({ mode: m, label }) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded border px-4 py-2 text-sm font-semibold uppercase tracking-wider disabled:opacity-30 ${
              mode === m
                ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                : "border-slate-800 hover:border-cyan-500"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          disabled={busy || !wreckHere}
          onClick={() => act("salvage")}
          className="rounded border border-slate-800 px-4 py-2 text-sm font-semibold uppercase tracking-wider hover:border-amber-500 disabled:opacity-30"
        >
          Salvage
        </button>
        <button
          disabled={busy}
          onClick={() => act("extract")}
          className="ml-auto rounded border border-amber-700 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-amber-400 hover:border-amber-500 disabled:opacity-30"
        >
          Extract
        </button>
      </div>

      {mode === "attack" && view.chassis.weapons.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {view.chassis.weapons.map((w, i) => (
            <button
              key={i}
              onClick={() => setSelectedWeapon(i)}
              className={`rounded border px-3 py-1.5 text-xs uppercase tracking-wider ${
                selectedWeapon === i
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                  : "border-slate-800 text-slate-400 hover:border-cyan-500"
              }`}
            >
              {w.attack} atk · {w.range} rng
              {w.aoeRadius > 0 ? ` · AoE ${w.aoeRadius}` : ""}
            </button>
          ))}
        </div>
      )}
      <p className={`mb-4 text-[11px] ${ATOMS.textDim}`}>{modeHint[mode]}</p>

      <div
        className="relative mb-6"
        style={{ width: view.w * cellSize, height: view.h * cellSize }}
      >
        {/* Background layer: fog/obstacle/highlight tiles and click
            targets. No markers live here any more — see the overlay below —
            so this grid never needs to remount anything just because an
            entity moved. */}
        <div
          className="grid bg-black/40"
          style={{ gridTemplateColumns: `repeat(${view.w}, ${cellSize}px)` }}
        >
          {Array.from({ length: view.h }, (_, y) =>
            Array.from({ length: view.w }, (_, x) => {
              const key = `${x},${y}`;
              const cell = cellByKey.get(key);
              const entity = entityByKey.get(key);
              const isMoveTarget = mode === "move" && reachable.has(key);
              const isAoeTarget =
                mode === "attack" && isAoeWeapon && aoeTargetTiles.has(key);
              const isAttackTarget =
                mode === "attack" &&
                !isAoeWeapon &&
                !!entity &&
                attackableEntities.some((e) => e.x === x && e.y === y);
              const clickable = isMoveTarget || isAttackTarget || isAoeTarget;
              const seen = cell?.seen ?? false;
              const bg = !seen
                ? "#05070a"
                : cell?.obstacle
                  ? "#2A333D"
                  : "#141B22";
              const highlight = isMoveTarget
                ? "rgba(34,211,238,.18)"
                : isAttackTarget
                  ? "rgba(217,86,79,.22)"
                  : isAoeTarget
                    ? "rgba(217,86,79,.12)"
                    : undefined;
              return (
                <div
                  key={key}
                  title={
                    entity ? `${entity.kind} (${entity.hp} hp)` : undefined
                  }
                  onClick={clickable ? () => clickCell(x, y) : undefined}
                  // border instead of the grid's gap/padding for the
                  // line-between-cells look — box-sizing: border-box (see
                  // app/globals.css) means a border doesn't change the box's
                  // outer size, so cell (x,y)'s top-left stays exactly
                  // (x*cellSize, y*cellSize) — the overlay's marker math has
                  // to match this exactly, or a gap/padding here alone
                  // (as it was) drifts every marker off its actual cell.
                  className={`border border-black/40 ${clickable ? "cursor-pointer" : ""}`}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    background: highlight ?? bg,
                  }}
                />
              );
            }),
          )}
        </div>

        {/* Marker overlay: everything that can move or animate. Each marker
            is keyed by a STABLE identity (entity id, "proxy", or the
            wreck's tile) rather than by position, and positioned with a
            transform the browser can transition — that's what makes a
            crawler actually slide toward the Proxy instead of teleporting
            from one grid cell's marker slot to another's. */}
        <div className="pointer-events-none absolute inset-0">
          {view.wrecks.map((w) => {
            const key = `${w.x},${w.y}`;
            const isActing = actingKey === key;
            return (
              <div
                key={key}
                className="absolute flex items-center justify-center"
                style={{
                  width: cellSize,
                  height: cellSize,
                  transform: `translate(${w.x * cellSize}px, ${w.y * cellSize}px)`,
                }}
              >
                <div
                  key={isActing ? `${key}-${pulseToken}` : "wreck"}
                  className={`h-1.5 w-1.5 rounded-full bg-amber-300 ${isActing ? "pulse-fade" : ""}`}
                />
              </div>
            );
          })}

          {view.entities.map((e) => {
            const key = `${e.x},${e.y}`;
            const isActing = actingKey === key;
            return (
              <div
                key={e.id}
                title={`${e.kind} (${e.hp} hp)`}
                className="absolute flex items-center justify-center transition-transform duration-300 ease-out"
                style={{
                  width: cellSize,
                  height: cellSize,
                  transform: `translate(${e.x * cellSize}px, ${e.y * cellSize}px)`,
                }}
              >
                <div
                  key={isActing ? `${key}-${pulseToken}` : e.id}
                  className={`h-2.5 w-2.5 rounded-sm ${isActing ? (actingIsAttack ? "pulse-fade-attack" : "pulse-fade") : ""}`}
                  style={{ background: ENTITY_COLOR[e.kind] }}
                />
              </div>
            );
          })}

          {(() => {
            const key = `${view.x},${view.y}`;
            const isActing = actingKey === key;
            return (
              <div
                className="absolute flex items-center justify-center transition-transform duration-300 ease-out"
                style={{
                  width: cellSize,
                  height: cellSize,
                  transform: `translate(${view.x * cellSize}px, ${view.y * cellSize}px)`,
                }}
              >
                {/* Pulse (scale) and facing (rotate) both need `transform`,
                    so they're split across two elements — the animation
                    would otherwise clobber the rotation for its duration. */}
                <div
                  key={isActing ? `proxy-${pulseToken}` : "proxy"}
                  className={
                    isActing
                      ? actingIsAttack
                        ? "pulse-fade-attack"
                        : "pulse-fade"
                      : undefined
                  }
                >
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "4px solid transparent",
                      borderRight: "4px solid transparent",
                      borderBottom: "7px solid #22D3EE",
                      transform: `rotate(${(Math.atan2(facing.dy, facing.dx) * 180) / Math.PI + 90}deg)`,
                    }}
                  />
                </div>
              </div>
            );
          })()}

          {shot && (
            <div
              key={shot.id}
              className="shot-marker"
              style={
                {
                  "--sx": `${shot.fromX * cellSize + cellSize / 2}px`,
                  "--sy": `${shot.fromY * cellSize + cellSize / 2}px`,
                  "--tx": `${shot.toX * cellSize + cellSize / 2}px`,
                  "--ty": `${shot.toY * cellSize + cellSize / 2}px`,
                } as React.CSSProperties
              }
            />
          )}
        </div>
      </div>

      <div>
        <h2
          className={`mb-2 text-[11px] font-bold uppercase tracking-wider ${ATOMS.textDim}`}
        >
          Log
        </h2>
        <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
          {view.log
            .slice(-20)
            .reverse()
            .map((l, i) => (
              <p key={i} className={ATOMS.textDim}>
                <span className={ATOMS.textDimmer}>[{l.n}]</span> {l.msg}
              </p>
            ))}
        </div>
      </div>
    </div>
  );
}
