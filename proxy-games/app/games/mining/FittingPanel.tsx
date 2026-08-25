'use client';

import { useMemo } from 'react';
import { CFG, chassisFrom, fieldDims, surveyReport } from './engine';
import type { Alloc, SurveyReport, SurveyTier } from './engine';

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

const CLAIM_OPTIONS = [20, 35, 50];

function sameAlloc(a: Alloc, b: Alloc) {
  return SYSTEMS.every(k => (a[k] || 0) === (b[k] || 0));
}

interface FittingPanelProps {
  alloc: Alloc;
  claim: number;
  survey: SurveyTier;
  seed: number;
  onAllocChange: (alloc: Alloc) => void;
  onClaimChange: (claim: number) => void;
  onSurveyChange: (survey: SurveyTier) => void;
  onLaunch: () => void;
}

export function FittingPanel({
  alloc, claim, survey, seed,
  onAllocChange, onClaimChange, onSurveyChange, onLaunch
}: FittingPanelProps) {
  const ch = useMemo(() => chassisFrom(alloc), [alloc]);
  const volUsed = SYSTEMS.reduce((n, k) => n + (alloc[k] || 0), 0);
  const left = CFG.VOLUME_TOTAL - volUsed;
  const dims = fieldDims();
  const activePreset = PRESETS.find(([, a]) => sameAlloc(alloc, a));

  function step(key: keyof Alloc, d: number) {
    if (d > 0 && volUsed >= CFG.VOLUME_TOTAL) return;
    onAllocChange({ ...alloc, [key]: Math.max(0, (alloc[key] || 0) + d) });
  }

  return (
    <>
      <div className="sect">
        <div className="lbl">Preset rigs</div>
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
      </div>

      <div className="sect">
        <div className="lbl">Hull volume</div>
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
      </div>

      <div className="sect">
        <div className="lbl">Derived</div>
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

      <div className="sect">
        <div className="lbl">Claim for this run · max {CFG.ENERGY_MAX}</div>
        <div className="claims">
          {CLAIM_OPTIONS.map(v => (
            <button key={v} className={`claimbtn ${v === claim ? 'on' : ''}`} onClick={() => onClaimChange(v)}>{v}E</button>
          ))}
        </div>
        <div className="derived" style={{ marginTop: 8 }}>
          <div><span>Target</span><b>{claim}u of ore</b></div>
          <div><span>Hauls to carry it</span><b>~{Math.ceil(claim / ch.hold)}</b></div>
          <div><span>Mobilisation, per unit</span><b>{(CFG.LAUNCH_COST / claim).toFixed(1)}</b></div>
          <div><span>Site size</span><b>{dims.W} × {dims.H}</b></div>
        </div>

        <div className="lbl" style={{ marginTop: 16 }}>Survey</div>
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

        <ReportPanel seed={seed} survey={survey} />

        <button className="go" onClick={onLaunch}>Launch run</button>
      </div>

      <div className="sect key">
        <div className="lbl">How a run works</div>
        <p>You claim <b>{claim} units</b> of ore for this run — one energy each. <b>One tank of fuel, no resupply.</b> Fall short and you&rsquo;ve burnt a whole tank for a partial load.</p>
        <p>Claiming big is cheaper per unit — mobilising the rig costs the same either way, so {claim}u carries it at <b>{(CFG.LAUNCH_COST / claim).toFixed(1)}</b> a unit. Claiming small is safe and expensive. That&rsquo;s the bet.</p>
        <p>Your hold only carries {ch.hold}u, so you&rsquo;ll drive back to base to unload and head out again — <i>on the same tank</i>. Those return trips are what tunnels pay for.</p>
        <p>Cutting fresh rock costs full price plus a dig surcharge. Re-crossing a tunnel you already cut costs {Math.round(CFG.TUNNEL_MULT * 100)}% — so early trips pay for later ones, and the network compounds all day.</p>
        <p><b>You cannot see the ground.</b> Rock, hard seams, gas and caverns are only ever learned by cutting into them, or by standing next to them.</p>
        <p><b>Sensors detect metal, not terrain.</b> A ping costs fuel and shows ore pockets as fuzzy contacts — mass reads true, position is a guess, and grade comes back only as a range. Ping the same pocket again from a different angle and the fix tightens. The analyser is what narrows the grade estimate.</p>
        <p>A <b>survey</b> filed before launch reports <i>totals only</i> — how much ore the face holds, roughly how deep it sits, how much of it is high grade. Never positions. It exists so you can decide how much of your day to claim, and what to strap on before you go. You still fly blind.</p>
        <p>Beyond ping range you get a single <b>bearing</b> to the strongest return. Direction only. No distance.</p>
        <p><b>Hard seams cannot be dug.</b> Route around them. <b>Gas pockets</b> hit far harder than ordinary ground. <b>Caverns</b> are already open — free to enter and cheap to cross, and finding one mid-shaft is the best thing that can happen to a run.</p>
        <p><b>Turning costs fuel.</b> Straight lines are cheap; weaving is not. Steering is what makes weaving affordable.</p>
        <p><b>Hazards</b> bite once, when you first cut the cell, and take sink. At zero sink the proxy is wrecked. Rich ore tends to sit near bad ground.</p>
        <p><b>Ore is only yours once it&rsquo;s banked.</b> Drive back to BASE to unload, then go out again if fuel remains. Run dry in the field and everything you&rsquo;re carrying is lost, along with the energy spent lifting it.</p>
        <div className="keyrow"><span className="sw t1"></span>grade 1 · {CFG.GRADE_VALUE[1]}/u</div>
        <div className="keyrow"><span className="sw t2"></span>grade 2 · {CFG.GRADE_VALUE[2]}/u</div>
        <div className="keyrow"><span className="sw t3"></span>grade 3 · {CFG.GRADE_VALUE[3]}/u</div>
        <div className="keyrow"><span className="sw t4"></span>grade 4 · {CFG.GRADE_VALUE[4]}/u</div>
        <div className="keyrow"><span className="sw rock"></span>unbroken rock</div>
        <div className="keyrow"><span className="sw tun"></span>tunnel — cheap to re-cross</div>
        <div className="keyrow"><span className="sw cav"></span>cavern — open ground, free to enter</div>
        <div className="keyrow"><span className="sw sem"></span>hard seam — cannot be cut</div>
        <div className="keyrow"><span className="sw haz">3</span>hazard, sink cost on first cut</div>
        <div className="keyrow"><span className="sw haz gas2">8</span>gas pocket, far worse</div>
        <div className="keyrow"><span className="sw con"></span>sensor contact — fuzzy until triangulated</div>
      </div>
    </>
  );
}

// The report is totals only — never positions. It exists to answer one question:
// is this face worth 20 energy or 50?
function ReportPanel({ seed, survey }: { seed: number; survey: SurveyTier }) {
  const rep = useMemo<SurveyReport | null>(() => surveyReport(seed, survey), [seed, survey]);
  if (!rep) {
    return <div className="report none">No survey filed. You will not know what this face holds until you are standing in it.</div>;
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
