'use client';

import { useEffect, useRef } from 'react';
import { CFG, DIRS, idx, inBounds } from '@/lib/mining-engine';
import type { DirKey } from '@/lib/mining-engine';
import type { PublicRunView } from '@/lib/mining-run-store';
import { atBase, heldUnits } from './view';

const ARROWS: Record<string, string> = { E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖', N: '↑', NE: '↗' };
// Rotation for the heading indicator — drawn facing "up" (North) by
// default in CSS, rotated clockwise from there to the real heading.
const DIR_ANGLE: Record<DirKey, number> = { N: 0, E: 90, S: 180, W: 270 };

export function StatusPanel({ run }: { run: PublicRunView }) {
  const ch = run.chassis;
  const held = heldUnits(run);
  const home = run.homeCost;
  const tight = run.fuel < home * 1.25;
  const thin = !atBase(run) && run.fuel < home * 1.2;

  const gauge = (cls: string, name: string, val: string | number, max: number, extra = '') => (
    <div className="gauge" key={name}>
      <div className="gauge-top"><span>{name}</span><b>{val}{extra}</b></div>
      <div className={`bar ${cls}`}><i style={{ width: `${Math.max(0, Math.min(100, max ? (Number(val) / max) * 100 : 0))}%` }} /></div>
    </div>
  );

  return (
    <>
      <div className="sect">
        <div className="lbl">Proxy</div>
        {gauge('b-fuel', 'Fuel', run.fuel.toFixed(1), ch.fuelCap, ` / ${ch.fuelCap}`)}
        {gauge('b-sink', 'Sink', run.sink, ch.sinkCap, ` / ${ch.sinkCap}`)}
        {gauge('b-hold', 'Hold', held, ch.hold, ` / ${ch.hold}u`)}
        {gauge('b-energy', 'Claim left', run.energy, run.energyStart, ` / ${run.energyStart}u`)}
        {thin && (
          <div style={{ color: 'var(--danger)', fontSize: 11, margin: '-4px 0 8px' }}>
            Fuel is thin — you may not make it back
          </div>
        )}
      </div>
      <div className="sect">
        <div className="lbl">Position</div>
        <div className="derived">
          <div><span>Fuel home</span><b style={{ color: tight ? 'var(--danger)' : 'var(--text)' }}>{home.toFixed(1)}</b></div>
          <div><span>Heading</span><b>{run.dir || '—'}</b></div>
          <div><span>Hauls made</span><b>{run.trip - 1}</b></div>
          <div><span>Survey</span><b>{CFG.SURVEY[run.survey].label}</b></div>
          <div><span>Pings used</span><b>{run.pings}</b></div>
          <div><span>Contacts held</span><b>{run.contacts.length}</b></div>
          <div><span>Banked</span><b>{run.banked.reduce((n, o) => n + o.units, 0)}u</b></div>
          <div><span>Carrying</span><b>{held}u</b></div>
        </div>
      </div>
      <div className="sect">
        <div className="lbl">Grade key</div>
        <div className="derived">
          {[1, 2, 3, 4].map(t => (
            <div key={t}><span style={{ color: `var(--g${t})` }}>■ grade {t}</span><b>{CFG.GRADE_VALUE[t]} / unit</b></div>
          ))}
        </div>
      </div>
      <div className="sect">
        <div className="lbl">Field key</div>
        <div className="keyrow"><span className="sw rock"></span>unbroken rock</div>
        <div className="keyrow"><span className="sw tun"></span>tunnel — cheap to re-cross</div>
        <div className="keyrow"><span className="sw cav"></span>cavern — open ground, free to enter</div>
        <div className="keyrow"><span className="sw sem"></span>hard seam — cannot be cut</div>
        <div className="keyrow"><span className="sw haz">3</span>hazard, sink cost on first cut</div>
        <div className="keyrow"><span className="sw haz gas2">8</span>gas pocket, far worse</div>
        <div className="keyrow"><span className="sw con"></span>sensor contact — fuzzy until triangulated</div>
        <div className="keyrow"><span className="sw sur"></span>survey contact — no fix yet</div>
      </div>
    </>
  );
}

export function RunField({ run, onMove }: { run: PublicRunView; onMove: (dir: DirKey) => void }) {
  const px = Math.max(20, Math.min(38, Math.floor(620 / CFG.W)));
  const fs = Math.max(9, Math.round(px * 0.32));

  const reach = new Set<number>();
  if (run.status === 'active') {
    for (const k of Object.keys(DIRS) as DirKey[]) {
      const nx = run.x + DIRS[k][0], ny = run.y + DIRS[k][1];
      if (inBounds(nx, ny)) reach.add(idx(nx, ny));
    }
  }

  const cells = [];
  for (let y = 0; y < CFG.H; y++) {
    for (let x = 0; x < CFG.W; x++) {
      const c = run.cells[idx(x, y)];
      const isBase = x === run.base.x && y === run.base.y;
      const known = c.known;
      let cls = 'cell';
      if (isBase) cls += ' base';
      else if (!known) cls += ' unknown';
      else if (c.seam) cls += ' seam';
      else if (c.tier > 0) cls += ` ore t${c.tier}`;
      else if (c.cavern) cls += ' cavern';
      else if (c.dug) cls += ' tunnel';
      if (known && c.dug && c.tier > 0) cls += ' cut';
      // Caverns are dug:true the instant they're discovered (free ground),
      // so this naturally never fires for them — exactly the exception asked
      // for. Seams are excluded explicitly: they're permanent obstacles,
      // already visually distinct, and can never be "dug" at all.
      if (known && !c.dug && !c.seam) cls += ' undug';
      // Same visibility rule as the .haz badge itself: hazard is a
      // property of the cell, discovered once and shown from then on
      // (matches the badge already persisting after a hazard's been
      // triggered — see applyMove in mining-engine.ts, hazard isn't
      // cleared on entry, only its one-time damage is).
      if (known && c.hazard > 0 && !isBase) cls += ` hazard${c.gas ? ' gas' : ''}`;
      const isReach = reach.has(idx(x, y));
      if (isReach) cls += ' reach';
      const text = isBase ? 'BASE'
        : !known ? ''
        : c.seam ? '▨'
        : c.tier > 0 ? String(c.units)
        : c.cavern ? '○'
        : c.dug ? '·' : '';
      const dir: DirKey = x > run.x ? 'E' : x < run.x ? 'W' : y > run.y ? 'S' : 'N';
      cells.push(
        <div
          key={`${x}:${y}`}
          className={cls}
          tabIndex={isReach ? 0 : undefined}
          onClick={isReach ? () => onMove(dir) : undefined}
          onKeyDown={isReach ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMove(dir); } } : undefined}
        >
          {text}
          {known && c.hazard > 0 && !isBase && <span className={`haz${c.gas ? ' gas' : ''}`}>{c.hazard}</span>}
          {x === run.x && y === run.y && (
            <>
              <span className="proxy" />
              {run.dir && <span className="proxy-front" style={{ transform: `rotate(${DIR_ANGLE[run.dir]}deg)` }} />}
            </>
          )}
        </div>
      );
    }
  }

  const fieldStyle = {
    gridTemplateColumns: `repeat(${CFG.W}, ${px}px)`,
    '--px': `${px}px`,
    '--fs': `${fs}px`,
  } as React.CSSProperties;

  const gx = (v: number) => 4 + v * (px + 2) + px / 2;

  return (
    <>
      <div className="field" style={fieldStyle}>{cells}</div>
      {run.status === 'active' && run.contacts.map(k => {
        const r = Math.max(px * 0.62, (k.blur + 0.45) * px);
        return (
          <div
            key={k.key}
            className={`contact${k.survey ? ' surveyed' : ''}`}
            style={{ left: gx(k.x), top: gx(k.y), width: r * 2, height: r * 2, opacity: Math.max(0.30, 0.85 - k.blur * 0.18) }}
          >
            <span>
              {k.mass}u
              {!k.survey && <><br />{`g${k.lo === k.hi ? k.lo : `${k.lo}–${k.hi}`}`}</>}
            </span>
          </div>
        );
      })}
      {run.status === 'active' && run.bearing && (
        <div className="bearing"><b>{ARROWS[run.bearing.dir]}</b> strong return · {run.bearing.mass}u</div>
      )}
    </>
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

export function RunControls({
  run, lastMsg, equipmentAvailable, onExtract, onPing, onEnd, onSiphon, onScanLine,
}: RunControlsProps) {
  const here = run.status === 'active' ? run.cells[idx(run.x, run.y)] : null;
  // A fully-extracted cell always has tier reset to 0 in the same step it's
  // marked spent (see applyExtract in the engine), so tier > 0 alone is
  // already a complete "can still cut here" check.
  const canCut = !!here && here.tier > 0 && run.status === 'active';
  const based = run.status === 'active' && atBase(run);
  const cd = Math.max(0, run.pingReady - run.step);
  const canPing = run.status === 'active' && cd === 0 && run.fuel >= run.chassis.pingFuel;

  // Single-use field tools — see lib/mining-engine.ts's applySiphon /
  // applyLineScan and the equipment slot system in lib/mining-inventory.ts.
  // Only shown at all once one's actually equipped; consumed on use.
  const hasSiphon = equipmentAvailable.includes('ore_siphon');
  const hasScanner = equipmentAvailable.includes('line_scanner');
  const canSiphon = run.status === 'active' && run.carrying.length > 0;
  const canScanLine = run.status === 'active' && run.dir !== null;

  return (
    <>
      <div className="controls">
        <button className="cbtn" disabled={!canCut} onClick={onExtract}>
          Extract {here && here.tier ? `(${here.units}u g${here.tier})` : ''}
        </button>
        <button className="cbtn ping" disabled={!canPing} onClick={onPing}>
          {cd ? `Sensors ${cd}` : `Ping (${run.chassis.pingFuel.toFixed(1)} fuel)`}
        </button>
        {hasSiphon && (
          <button className="cbtn" disabled={!canSiphon} onClick={onSiphon} title="Burns carried ore for fuel. Consumed on use.">
            Siphon ore
          </button>
        )}
        {hasScanner && (
          <button
            className="cbtn"
            disabled={!canScanLine}
            onClick={onScanLine}
            title={`Scans the full ${run.dir ?? ''} line from here, stopped by the first hard seam. Consumed on use.`}
          >
            Scan {run.dir ?? ''} line
          </button>
        )}
        <button className="cbtn warn" disabled={!based} onClick={onEnd}>End run</button>
      </div>
      <div className="hint">
        {lastMsg || (run.status === 'active'
          ? 'Arrows or WASD move · E extract · P ping · sensors find metal, never terrain · reach BASE to unload'
          : '')}
      </div>
    </>
  );
}

export function RunLedger({ run }: { run: PublicRunView }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [run.log.length]);

  const rows = run.log.slice(-160);
  return (
    <div className="ledger" ref={ref}>
      {rows.length === 0 ? (
        <div><span className="n">—</span><span>no moves yet</span><span></span></div>
      ) : rows.map(l => (
        <div key={l.n}>
          <span className="n">{l.n}</span>
          <span className={l.k === 'ex' ? 'ex' : l.k === 'bad' ? 'bad' : l.k === 'good' ? 'good' : ''}>{l.t}</span>
          <span className="c">{l.c ? `-${l.c.toFixed(2)}` : ''}</span>
        </div>
      ))}
    </div>
  );
}
