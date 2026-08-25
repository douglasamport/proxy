'use client';

import { useEffect, useMemo, useState } from 'react';
import { CFG, chassisFrom, fieldDims } from '@/lib/mining-engine';
import type { Alloc, SurveyReport, SurveyTier } from '@/lib/mining-engine';

export const PRESETS: [string, Alloc, string][] = [
  ['Balanced',   {fuel:4,cargo:3,armour:2,drive:3,steer:2,sensor:2,analyser:0}, 'The reference rig. Nothing outstanding, nothing missing.'],
  ['Hauler',     {fuel:3,cargo:6,armour:2,drive:2,steer:1,sensor:2,analyser:0}, 'Huge hold, few hauls. Best cost per unit on small claims, strands on big ones.'],
  ['Surveyor',   {fuel:4,cargo:2,armour:2,drive:2,steer:1,sensor:4,analyser:1}, 'Sees furthest and reads it best. Small hold, so it works what it finds carefully.'],
  ['Deep shaft', {fuel:6,cargo:3,armour:1,drive:2,steer:1,sensor:2,analyser:1}, 'Maximum tank, minimum plate. Goes furthest, wrecks most.'],
  ['Sprinter',   {fuel:4,cargo:2,armour:1,drive:5,steer:2,sensor:2,analyser:0}, 'Cheap ground, thin everything else. Covers distance, not hazard.'],
  ['Weaver',     {fuel:3,cargo:3,armour:2,drive:2,steer:4,sensor:2,analyser:0}, 'Turns for almost nothing. Picks its way through scattered pockets.'],
  ['Deepcore',   {fuel:4,cargo:3,armour:4,drive:2,steer:1,sensor:2,analyser:0}, 'Heavy plate. Cuts through gas and hard ground others must route around.'],
  ['Blind dig',  {fuel:5,cargo:4,armour:3,drive:2,steer:2,sensor:0,analyser:0}, 'No sensors at all. Everything in the hull, nothing in the eyes. Pure nerve.']
];

const SYSTEMS: (keyof Alloc)[] = ['fuel', 'cargo', 'armour', 'drive', 'steer', 'sensor', 'analyser'];

const ROWS: [keyof Alloc, string, string][] = [
  ['fuel',   'Fuel tank',    `+${CFG.FUEL_PER_UNIT} fuel`],
  ['cargo',  'Cargo hold',   `+${CFG.HOLD_PER_UNIT} units carried`],
  ['armour', 'Armour plate', `+${CFG.SINK_PER_PLATE} sink`],
  ['drive',  'Drive',        `+${CFG.SPEED_PER_UNIT} speed — cheaper ground`],
  ['steer',  'Steering',     `+${CFG.MOVE_PER_UNIT} movement — cheaper turns`],
  ['sensor', 'Sensor array', `+${CFG.SENSOR_RANGE_PER} ping range, tighter fixes`],
  ['analyser', 'Analyser',   `narrows the grade estimate`]
];

function sameAlloc(a: Alloc, b: Alloc) {
  return SYSTEMS.every(k => (a[k] || 0) === (b[k] || 0));
}

interface FittingPanelProps {
  alloc: Alloc;
  claim: number;
  survey: SurveyTier;
  runId: string | null;
  onAllocChange: (alloc: Alloc) => void;
  onClaimChange: (claim: number) => void;
  onSurveyChange: (survey: SurveyTier) => void;
  onLaunch: () => void;
}

// Order matches the decisions a player actually makes, in order: the field
// is assigned (server-side, before this component ever mounts), then buy a
// survey or skip it, then buy a claim size, then fit out equipment, then launch.
export function FittingPanel({
  alloc, claim, survey, runId,
  onAllocChange, onClaimChange, onSurveyChange, onLaunch
}: FittingPanelProps) {
  const ch = useMemo(() => chassisFrom(alloc), [alloc]);
  const volUsed = SYSTEMS.reduce((n, k) => n + (alloc[k] || 0), 0);
  const left = CFG.VOLUME_TOTAL - volUsed;
  const dims = fieldDims();
  const activePreset = PRESETS.find(([, a]) => sameAlloc(alloc, a));
  const claimCost = CFG.CLAIM_COST[claim] ?? 0;

  function step(key: keyof Alloc, d: number) {
    if (d > 0 && volUsed >= CFG.VOLUME_TOTAL) return;
    onAllocChange({ ...alloc, [key]: Math.max(0, (alloc[key] || 0) + d) });
  }

  return (
    <>
      <div className="sect">
        <div className="lbl">Survey</div>
        <div className="claims">
          {(Object.keys(CFG.SURVEY) as SurveyTier[]).map(k => (
            <button key={k} className={`claimbtn ${k === survey ? 'on' : ''}`} onClick={() => onSurveyChange(k)}>
              {CFG.SURVEY[k].label}
            </button>
          ))}
        </div>
        <div className="ptip">
          {CFG.SURVEY[survey].note}
          {CFG.SURVEY[survey].cost ? <> <b style={{ color: 'var(--text)' }}>{CFG.SURVEY[survey].cost}</b>.</> : null}
        </div>
        <ReportPanel runId={runId} survey={survey} />
      </div>

      <div className="sect">
        <div className="lbl">Claim for this run · max {CFG.ENERGY_MAX}</div>
        <div className="claims">
          {CFG.CLAIM_OPTIONS.map(v => (
            <button key={v} className={`claimbtn ${v === claim ? 'on' : ''}`} onClick={() => onClaimChange(v)}>{v}E</button>
          ))}
        </div>
        <div className="ptip">Claiming this size costs <b style={{ color: 'var(--text)' }}>{claimCost}</b> up front.</div>
        <div className="derived" style={{ marginTop: 8 }}>
          <div><span>Target</span><b>{claim}u of ore</b></div>
          <div><span>Claim cost</span><b>{claimCost}</b></div>
          <div><span>Hauls to carry it</span><b>~{Math.ceil(claim / ch.hold)}</b></div>
          <div><span>Site size</span><b>{dims.W} × {dims.H}</b></div>
        </div>
      </div>

      <div className="sect build-section">
        <div className="lbl">Build</div>
        <div className="presets">
          {PRESETS.map(([name, a, tip]) => (
            <button
              key={name}
              className={`pbtn ${sameAlloc(alloc, a) ? 'on' : ''}`}
              title={tip}
              onClick={() => onAllocChange({ ...a })}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="ptip">{activePreset ? activePreset[2] : 'Custom fitting.'}</div>

        {ROWS.map(([k, name, sub]) => (
          <div className="fit-row" key={k}>
            <div className="fit-name">{name}<small>{sub}</small></div>
            <div className="stepper">
              <button onClick={() => step(k, -1)} disabled={(alloc[k] || 0) <= 0}>−</button>
              <span>{alloc[k]}</span>
              <button onClick={() => step(k, 1)} disabled={left <= 0}>+</button>
            </div>
          </div>
        ))}
        <div className="vol"><span>Unallocated</span><b>{left}</b></div>

        <div className="derived">
          <div><span>Hold per trip</span><b>{ch.hold}u</b></div>
          <div><span>Fuel capacity</span><b>{ch.fuelCap.toFixed(0)}</b></div>
          <div><span>Dig a fresh cell</span><b>{(1 / ch.speed + CFG.DIG_FUEL).toFixed(2)}</b></div>
          <div><span>Drive a tunnel</span><b>{(1 / ch.speed * CFG.TUNNEL_MULT).toFixed(2)}</b></div>
          <div><span>Turn surcharge</span><b>{(CFG.TURN_BASE / ch.movement).toFixed(2)}</b></div>
          <div><span>Fresh digs available</span><b>~{Math.floor(ch.fuelCap / (1 / ch.speed + CFG.DIG_FUEL))}</b></div>
          <div><span>Sink</span><b>{ch.sinkCap}</b></div>
          <div><span>Ping range</span><b>{ch.sensorRange.toFixed(1)} cells</b></div>
          <div><span>Fix accuracy</span><b>±{ch.sensorBlur.toFixed(1)}</b></div>
          <div><span>Ping cost</span><b>{ch.pingFuel.toFixed(1)} fuel</b></div>
          <div><span>Grade estimate</span><b>±{(ch.analyser / 2).toFixed(1)} tiers</b></div>
        </div>
      </div>

      <button className="go" onClick={onLaunch} disabled={!runId}>Launch run</button>
    </>
  );
}

// The report is totals only — never positions. It exists to answer one
// question: is this face worth 20 energy or 50? Fetched fresh per tier —
// the server is the only thing that knows the seed this preview reads from.
function ReportPanel({ runId, survey }: { runId: string | null; survey: SurveyTier }) {
  const [rep, setRep] = useState<SurveyReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!runId || survey === 'none') { setRep(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/runs/${runId}/survey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: survey }),
    })
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => { if (!cancelled) { setRep(data.report); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [runId, survey]);

  if (survey === 'none') {
    return <div className="report none">No survey filed. You will not know what this face holds until you are standing in it.</div>;
  }
  if (loading || !rep) {
    return <div className="report none">Reading survey…</div>;
  }

  const f = rep.fuzz;
  const band = (v: number, unit: string) => f
    ? `${Math.round(v * (1 - f) / 5) * 5}–${Math.round(v * (1 + f) / 5) * 5}${unit}`
    : `${Math.round(v)}${unit}`;
  const depth = rep.depth < 0.30 ? 'close in'
    : rep.depth < 0.55 ? 'spread'
    : rep.depth < 0.80 ? 'mostly far'
    : 'all far out';
  const richShare = rep.mass ? rep.rich / rep.mass : 0;
  const verdict: [string, string] = rep.mass < 70 ? ['Thin face', 'var(--danger)']
    : rep.mass < 105 ? ['Workable', 'var(--fuel)']
    : ['Rich face', 'var(--ok)'];
  const advise = (rep.mass < 70
    ? 'Claim small. There is not enough here to carry a big commitment.'
    : rep.mass < 105
      ? 'A middling claim fits. A large one will run the face dry.'
      : 'Volume enough for a large claim.')
    + (rep.depth > 0.55
      ? ' Most of it is a long way out — bring fuel, not hold.'
      : rep.depth < 0.30
        ? ' It is all close to the mouth. Short trips, cheap fuel.'
        : '');

  return (
    <div className="report">
      <div className="rhead" style={{ color: verdict[1] }}>{verdict[0]}</div>
      <div className="derived">
        <div><span>Pockets</span><b>{f ? `${Math.max(1, rep.pockets - 1)}–${rep.pockets + 1}` : rep.pockets}</b></div>
        <div><span>Total ore</span><b>{band(rep.mass, 'u')}</b></div>
        <div><span>Ore sits</span><b>{depth}</b></div>
        <div><span>Grade 3+ share</span><b>{f ? (richShare < 0.2 ? 'low' : richShare < 0.4 ? 'some' : 'high') : Math.round(richShare * 100) + '%'}</b></div>
        {rep.byGrade && (
          <div><span>By grade</span><b>{rep.byGrade.slice(1).map((v, i) => v ? `g${i + 1}:${v}` : '').filter(Boolean).join('  ')}</b></div>
        )}
      </div>
      <div className="radvise">{advise}</div>
    </div>
  );
}
