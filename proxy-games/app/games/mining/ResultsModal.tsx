'use client';

import type { RunStatus, ScoreResult } from '@/lib/mining-engine';

const VERDICT: Record<string, [string, string]> = {
  banked: ['Run banked', 'var(--ok)'],
  stranded: ['Stranded — out of fuel', 'var(--danger)'],
  wrecked: ['Wrecked — sink gone', 'var(--danger)'],
};

function Delta({ a, b, invert = false }: { a: number; b: number; invert?: boolean }) {
  if (!a && !b) return null;
  const diff = a - b, up = invert ? diff < 0 : diff > 0;
  if (Math.abs(diff) < 0.005) return <span className="delta">even</span>;
  return <span className={`delta ${up ? 'up' : 'down'}`}>{diff > 0 ? '+' : ''}{diff.toFixed(diff % 1 ? 2 : 0)}</span>;
}

function Row({ name, a, b, fmt = (v: number) => v.toFixed(0), invert = false }: {
  name: string; a: number; b: number; fmt?: (v: number) => string; invert?: boolean;
}) {
  return (
    <tr>
      <td>{name}</td>
      <td className="you">{fmt(a)}</td>
      <td className="ai">{fmt(b)}</td>
      <td><Delta a={a} b={b} invert={invert} /></td>
    </tr>
  );
}

interface ResultsModalProps {
  status: RunStatus;
  seed: number;
  energyStart: number;
  you: ScoreResult;
  ai: ScoreResult;
  onAgain: () => void;
}

// Everything here is what the server computed and returned from
// POST /api/runs/[id]/end — this component doesn't run score() or runAI()
// itself, since both need the seed, which the client only ever learns once
// the run is already over (see lib/mining-run-store.ts).
export function ResultsModal({ status, seed, energyStart, you, ai, onAgain }: ResultsModalProps) {
  const [vtxt, vcol] = VERDICT[status] || ['Run over', 'var(--dim)'];

  return (
    <div className="scrim">
      <div className="card">
        <div className="verdict" style={{ color: vcol }}>{vtxt}</div>
        <h2>You vs. autopilot · seed {seed} · {energyStart}E claim</h2>
        <table>
          <thead><tr><th>Metric</th><th>You</th><th>Autopilot</th><th></th></tr></thead>
          <tbody>
            <Row name="Claim spent" a={you.claimSpent * 100} b={ai.claimSpent * 100} fmt={v => v.toFixed(0) + '%'} />
            <Row name="Units banked" a={you.units} b={ai.units} />
            <Row name="Trips" a={you.trips} b={ai.trips} invert />
            <Row name="Average grade" a={you.grade} b={ai.grade} fmt={v => v.toFixed(2)} />
            <Row name="Gross revenue" a={you.revenue} b={ai.revenue} />
            <Row name="Survey" a={you.surveyCost} b={ai.surveyCost} invert />
            <Row name="Claim cost" a={you.claimCost} b={ai.claimCost} invert />
            <Row name="Total cost" a={you.cost} b={ai.cost} invert />
            <Row name="Cost per unit" a={you.costPerUnit} b={ai.costPerUnit} fmt={v => v.toFixed(2)} invert />
            <Row name="Net" a={you.net} b={ai.net} />
            <Row name="Cost as % of revenue" a={you.margin * 100} b={ai.margin * 100} fmt={v => v.toFixed(1) + '%'} invert />
          </tbody>
        </table>
        {you.lost > 0 && (
          <div className="note" style={{ color: 'var(--danger)' }}>
            Lost {you.lost} units in the field, plus the energy spent lifting them.
          </div>
        )}
        <div className="note">Tonnage is capped by the day&rsquo;s energy. <b>Cost per unit</b> and <b>average grade</b> are where skill shows.</div>
        <div className="note" style={{ color: 'var(--ok)' }}>Run saved to your history.</div>
        <button className="go" onClick={onAgain} autoFocus>Refit &amp; run again</button>
      </div>
    </div>
  );
}
