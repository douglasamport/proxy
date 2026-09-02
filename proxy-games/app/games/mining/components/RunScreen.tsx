"use client";

import { useEffect, useRef } from "react";
import { CFG, DIRS } from "@/lib/mining-engine";
import type { DirKey } from "@/lib/mining-engine";
import type { PublicRunView } from "@/lib/mining-run-store";
import { atBase, heldUnits } from "../view";
import { ATOMS, GAME, PALETTE, SURFACE, oreColor } from "@/lib/mining-theme";
// Only RunField still needs this — the field grid is the one piece kept on
// mining.css (a dense per-cell HUD, not a card; see the comment on
// RunField below). Scoped locally to that component's own .mining-root
// wrapper, not applied to the rest of this now-Tailwind page.
import "../mining.css";
import { Gauge } from "@/components/Gauge";
import { Swatch, KeyRow } from "@/components/Swatch";

const ARROWS: Record<string, string> = {
  E: "→",
  SE: "↘",
  S: "↓",
  SW: "↙",
  W: "←",
  NW: "↖",
  N: "↑",
  NE: "↗",
};
// Rotation for the heading indicator — drawn facing "up" (North) by
// default in CSS, rotated clockwise from there to the real heading.
const DIR_ANGLE: Record<DirKey, number> = { N: 0, E: 90, S: 180, W: 270 };

export function StatusPanel({ run }: { run: PublicRunView }) {
  const ch = run.chassis;
  const held = heldUnits(run);
  const home = run.homeCost;
  const tight = run.fuel < home * 1.25;
  const thin = !atBase(run) && run.fuel < home * 1.2;

  const posRows: [string, string, boolean?][] = [
    ["Fuel home", home.toFixed(1), tight],
    ["Heading", run.dir || "—"],
    ["Hauls made", String(run.trip - 1)],
    ["Survey", CFG.SURVEY[run.survey].label],
    ["Pings used", String(run.pings)],
    ["Contacts held", String(run.contacts.length)],
    ["Banked", `${run.banked.reduce((n, o) => n + o.units, 0)}u`],
    ["Carrying", `${held}u`],
  ];

  return (
    <div className="space-y-4">
      <div className={`rounded-lg ${SURFACE.card} p-4`}>
        <div className={SURFACE.label}>Proxy</div>
        <div className="mt-3">
          <Gauge tone="fuel" label="Fuel" value={run.fuel.toFixed(1)} max={ch.fuelCap} suffix={` / ${ch.fuelCap}`} />
          <Gauge tone="sink" label="Sink" value={run.sink} max={ch.sinkCap} suffix={` / ${ch.sinkCap}`} />
          <Gauge tone="hold" label="Hold" value={held} max={ch.hold} suffix={` / ${ch.hold}u`} />
          <Gauge tone="energy" label="Claim left" value={run.energy} max={run.energyStart} suffix={` / ${run.energyStart}u`} />
        </div>
        {thin && <div className={`-mt-1 mb-2 text-[11px] ${ATOMS.textDanger}`}>Fuel is thin — you may not make it back</div>}
      </div>

      <div className={`rounded-lg ${SURFACE.card} p-4`}>
        <div className={SURFACE.label}>Position</div>
        <div className="mt-3 space-y-1">
          {posRows.map(([label, value, danger]) => (
            <div key={label} className="flex justify-between text-[11px]">
              <span className={ATOMS.textDim}>{label}</span>
              <b className={danger ? ATOMS.textDanger : ATOMS.textPrimary}>{value}</b>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-lg ${SURFACE.card} p-4`}>
        <div className={SURFACE.label}>Grade key</div>
        <div className="mt-3 space-y-1">
          {[1, 2, 3, 4].map(t => (
            <div key={t} className="flex justify-between text-[11px]">
              <span className={ATOMS.textDim}><Swatch bg={GAME.grade[t] ?? PALETTE.grade1} />grade {t}</span>
              <b className={ATOMS.textPrimary}>{CFG.GRADE_VALUE[t]} / unit</b>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-lg ${SURFACE.card} p-4`}>
        <div className={SURFACE.label}>Field key</div>
        <div className="mt-3">
          <KeyRow><Swatch bg={PALETTE.panel} border={PALETTE.line} />unbroken rock</KeyRow>
          <KeyRow><Swatch bg={GAME.tunnel} border={GAME.tunnelEdge} />tunnel — cheap to re-cross</KeyRow>
          <KeyRow><Swatch bg={GAME.cavern} border={GAME.cavernEdge} />cavern — open ground, free to enter</KeyRow>
          <KeyRow><Swatch bg={GAME.seam} border={GAME.seamEdge} />hard seam — cannot be cut</KeyRow>
          <KeyRow><Swatch bg={PALETTE.panel} border={PALETTE.line} color={PALETTE.danger} glyph="3" />hazard, sink cost on first cut</KeyRow>
          <KeyRow><Swatch bg={PALETTE.panel} border={PALETTE.line} color={PALETTE.gas} glyph="8" />gas pocket, far worse</KeyRow>
          <KeyRow><Swatch bg="rgba(84,198,220,.2)" border="rgba(84,198,220,.6)" />sensor contact — fuzzy until triangulated</KeyRow>
          <KeyRow><Swatch bg="rgba(140,160,180,.15)" border="rgba(140,160,180,.7)" />survey contact — no fix yet</KeyRow>
        </div>
      </div>
    </div>
  );
}

// The field grid stays on mining.css — a dense, per-cell pixel HUD is a
// game-board rendering problem, not a card, and there was nothing to gain
// by forcing it into Tailwind. Everything around it (above/below) moved.
export function RunField({
  run,
  onMove,
}: {
  run: PublicRunView;
  onMove: (dir: DirKey) => void;
}) {
  // Field dims are per-run now (Stage 6 — map size depends on unlocked
  // minerals), so grid layout and cell indexing come from `run.w`/`run.h`,
  // not the module-level CFG.W/H (a shared global that's only ever correct
  // for whichever run last set it server-side — meaningless on the client).
  const idxOf = (x: number, y: number) => y * run.w + x;
  const inB = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < run.w && y < run.h;
  const px = Math.max(20, Math.min(38, Math.floor(620 / run.w)));
  const fs = Math.max(9, Math.round(px * 0.32));

  const reach = new Set<number>();
  if (run.status === "active") {
    for (const k of Object.keys(DIRS) as DirKey[]) {
      const nx = run.x + DIRS[k][0],
        ny = run.y + DIRS[k][1];
      if (inB(nx, ny)) reach.add(idxOf(nx, ny));
    }
  }

  const cells = [];
  for (let y = 0; y < run.h; y++) {
    for (let x = 0; x < run.w; x++) {
      const c = run.cells[idxOf(x, y)];
      const isBase = x === run.base.x && y === run.base.y;
      const known = c.known;
      let cls = "cell";
      if (isBase) cls += " base";
      else if (!known) cls += " unknown";
      else if (c.seam) cls += " seam";
      else if (c.grade > 0) cls += ` ore t${c.grade}`;
      else if (c.cavern) cls += " cavern";
      else if (c.dug) cls += " tunnel";
      if (known && c.dug && c.grade > 0) cls += " cut";
      // Caverns are dug:true the instant they're discovered (free ground),
      // so this naturally never fires for them — exactly the exception asked
      // for. Seams are excluded explicitly: they're permanent obstacles,
      // already visually distinct, and can never be "dug" at all.
      if (known && !c.dug && !c.seam) cls += " undug";
      // Same visibility rule as the .haz badge itself: hazard is a
      // property of the cell, discovered once and shown from then on
      // (matches the badge already persisting after a hazard's been
      // triggered — see applyMove in mining-engine.ts, hazard isn't
      // cleared on entry, only its one-time damage is).
      if (known && c.hazard > 0 && !isBase)
        cls += ` hazard${c.gas ? " gas" : ""}`;
      const isReach = reach.has(idxOf(x, y));
      if (isReach) cls += " reach";
      // Ore's own base colour, by mineral — the `.t{grade}` class above is
      // still there for other cell states, but this inline background wins
      // for anything with ore on it, distinguishing what used to be one
      // amber ramp for every ore type into 13 (see lib/mining-theme.ts).
      const cellStyle: React.CSSProperties | undefined =
        c.grade > 0 ? { background: oreColor(c.oreType, c.grade) } : undefined;
      const text = isBase
        ? "BASE"
        : !known
          ? ""
          : c.seam
            ? "▨"
            : c.grade > 0
              ? String(c.units)
              : c.cavern
                ? "○"
                : c.dug
                  ? "·"
                  : "";
      const dir: DirKey =
        x > run.x ? "E" : x < run.x ? "W" : y > run.y ? "S" : "N";
      cells.push(
        <div
          key={`${x}:${y}`}
          className={cls}
          style={cellStyle}
          tabIndex={isReach ? 0 : undefined}
          onClick={isReach ? () => onMove(dir) : undefined}
          onKeyDown={
            isReach
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onMove(dir);
                  }
                }
              : undefined
          }
        >
          {text}
          {known && c.hazard > 0 && !isBase && (
            <span className={`haz${c.gas ? " gas" : ""}`}>{c.hazard}</span>
          )}
          {x === run.x && y === run.y && (
            <>
              <span className="proxy" />
              {run.dir && (
                <span
                  className="proxy-front"
                  style={{ transform: `rotate(${DIR_ANGLE[run.dir]}deg)` }}
                />
              )}
            </>
          )}
        </div>,
      );
    }
  }

  const fieldStyle = {
    gridTemplateColumns: `repeat(${run.w}, ${px}px)`,
    "--px": `${px}px`,
    "--fs": `${fs}px`,
  } as React.CSSProperties;

  const gx = (v: number) => 4 + v * (px + 2) + px / 2;

  return (
    <div className="mining-root">
      <div className="field" style={fieldStyle}>
        {cells}
      </div>
      {run.status === "active" &&
        run.contacts.map((k) => {
          const r = Math.max(px * 0.62, (k.blur + 0.45) * px);
          return (
            <div
              key={k.key}
              className={`contact${k.survey ? " surveyed" : ""}`}
              style={{
                left: gx(k.x),
                top: gx(k.y),
                width: r * 2,
                height: r * 2,
                opacity: Math.max(0.3, 0.85 - k.blur * 0.18),
              }}
            >
              <span>
                {k.mass}u
                {!k.survey && (
                  <>
                    <br />
                    {`g${k.lo === k.hi ? k.lo : `${k.lo}–${k.hi}`}`}
                  </>
                )}
              </span>
            </div>
          );
        })}
      {run.status === "active" && run.bearing && (
        <div className="bearing">
          <b>{ARROWS[run.bearing.dir]}</b> strong return · {run.bearing.mass}u
        </div>
      )}
    </div>
  );
}

interface RunControlsProps {
  run: PublicRunView;
  lastMsg: string;
  equipmentAvailable: string[];
  onExtract: () => void;
  onPing: () => void;
  onEnd: () => void;
  onSiphon: () => void;
  onScanLine: () => void;
}

function ControlButton({ children, disabled, warn, onClick, title }: {
  children: React.ReactNode; disabled: boolean; warn?: boolean; onClick: () => void; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex-1 rounded border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 ${
        warn
          ? SURFACE.btnWarn
          : `${ATOMS.borderLine} ${ATOMS.textDim} ${SURFACE.navLinkHover}`
      }`}
    >
      {children}
    </button>
  );
}

export function RunControls({
  run,
  lastMsg,
  equipmentAvailable,
  onExtract,
  onPing,
  onEnd,
  onSiphon,
  onScanLine,
}: RunControlsProps) {
  const here =
    run.status === "active" ? run.cells[run.y * run.w + run.x] : null;
  // A fully-extracted cell always has grade reset to 0 in the same step it's
  // marked spent (see applyExtract in the engine), so grade > 0 alone is
  // already a complete "can still cut here" check.
  const canCut = !!here && here.grade > 0 && run.status === "active";
  const based = run.status === "active" && atBase(run);
  const cd = Math.max(0, run.pingReady - run.step);
  const canPing =
    run.status === "active" && cd === 0 && run.fuel >= run.chassis.pingFuel;

  // Single-use field tools — see lib/mining-engine.ts's applySiphon /
  // applyLineScan and the equipment slot system in lib/mining-inventory.ts.
  // Only shown at all once one's actually equipped; consumed on use.
  const hasSiphon = equipmentAvailable.includes("ore_siphon");
  const hasScanner = equipmentAvailable.includes("line_scanner");
  const canSiphon = run.status === "active" && run.carrying.length > 0;
  const canScanLine = run.status === "active" && run.dir !== null;

  return (
    <div className="w-full max-w-2xl">
      <div className="flex flex-wrap gap-2">
        <ControlButton disabled={!canCut} onClick={onExtract}>
          Extract {here && here.grade ? `(${here.units}u g${here.grade})` : ""}
        </ControlButton>
        <ControlButton disabled={!canPing} onClick={onPing}>
          {cd ? `Sensors ${cd}` : `Ping (${run.chassis.pingFuel.toFixed(1)} fuel)`}
        </ControlButton>
        {hasSiphon && (
          <ControlButton disabled={!canSiphon} onClick={onSiphon} title="Burns carried ore for fuel. Consumed on use.">
            Siphon ore
          </ControlButton>
        )}
        {hasScanner && (
          <ControlButton
            disabled={!canScanLine}
            onClick={onScanLine}
            title={`Scans the full ${run.dir ?? ""} line from here, stopped by the first hard seam. Consumed on use.`}
          >
            Scan {run.dir ?? ""} line
          </ControlButton>
        )}
        <ControlButton disabled={!based} warn onClick={onEnd}>
          End run
        </ControlButton>
      </div>
      <div className={`mt-2 text-[11px] leading-snug ${ATOMS.textDim}`}>
        {lastMsg ||
          (run.status === "active"
            ? "Arrows or WASD move · E extract · P ping · sensors find metal, never terrain · reach BASE to unload"
            : "")}
      </div>
    </div>
  );
}

export function RunLedger({ run }: { run: PublicRunView }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [run.log.length]);

  const rows = run.log.slice(-160);
  const tone = (k: string) => (k === "ex" ? ATOMS.textTeal : k === "bad" ? ATOMS.textDanger : k === "good" ? ATOMS.textOk : ATOMS.textDim);

  return (
    <div ref={ref} className={`h-full overflow-y-auto rounded-lg ${SURFACE.card} p-2 font-mono text-[11px]`}>
      {rows.length === 0 ? (
        <div className={`flex gap-2 px-2 py-1 ${ATOMS.textDimmer}`}>
          <span className="w-6 text-right">—</span>
          <span>no moves yet</span>
        </div>
      ) : (
        rows.map(l => (
          <div key={l.n} className="flex gap-2 px-2 py-1">
            <span className={`w-6 shrink-0 text-right ${ATOMS.textDimmer}`}>{l.n}</span>
            <span className={`flex-1 ${tone(l.k)}`}>{l.t}</span>
            <span className={`shrink-0 ${ATOMS.textDimmer}`}>{l.c ? `-${l.c.toFixed(2)}` : ""}</span>
          </div>
        ))
      )}
    </div>
  );
}
