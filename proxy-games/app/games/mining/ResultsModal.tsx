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

// A cost line in the manifest. Survey is deliberately absent — it's already
// a real, separate deduction at purchase time (see purchaseSurvey() in
// lib/mining-run-store.ts); listing it here again would double-count it.
// Future per-run cost types (equipment consumed, etc.) belong in this same
// list once they exist.
function CostLine({ name, amount }: { name: string; amount: number }) {
  if (!amount) return null;
  return <div><span>{name}</span><b>-{amount.toFixed(0)}</b></div>;
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
  const netUp = you.net >= 0;

  return (
    <div className="scrim">
      <div className="card">
        <div className="verdict" style={{ color: vcol }}>{vtxt}</div>
        <h2>Run complete · seed {seed} · {energyStart}E claim</h2>

        <div className="sect manifest">
          <div className="lbl">Manifest</div>
          <div className="derived">
            <div><span>Ore income</span><b style={{ color: 'var(--ok)' }}>+{you.revenue.toFixed(0)}</b></div>
          </div>
          <div className="lbl" style={{ marginTop: 12 }}>Costs</div>
          <div className="derived">
            <CostLine name="Fuel" amount={you.fuelCost} />
            <CostLine name="Repair" amount={you.repair} />
            <CostLine name="Mobilisation fee" amount={you.launch} />
            <CostLine name="Claim" amount={you.claimCost} />
          </div>
          <div className="manifest-net">
            <span>Net</span>
            <b style={{ color: netUp ? 'var(--ok)' : 'var(--danger)' }}>{netUp ? '+' : ''}{you.net.toFixed(0)}</b>
          </div>
        </div>

        {you.lost > 0 && (
          <div className="note" style={{ color: 'var(--danger)' }}>
            Lost {you.lost} units in the field, plus the energy spent lifting them.
          </div>
        )}

        <details className="accordion">
          <summary>Compare to autopilot</summary>
          <table>
            <thead><tr><th>Metric</th><th>You</th><th>Autopilot</th><th></th></tr></thead>
            <tbody>
              <Row name="Claim spent" a={you.claimSpent * 100} b={ai.claimSpent * 100} fmt={v => v.toFixed(0) + '%'} />
              <Row name="Units banked" a={you.units} b={ai.units} />
              <Row name="Trips" a={you.trips} b={ai.trips} invert />
              <Row name="Average grade" a={you.grade} b={ai.grade} fmt={v => v.toFixed(2)} />
              <Row name="Gross revenue" a={you.revenue} b={ai.revenue} />
              <Row name="Claim cost" a={you.claimCost} b={ai.claimCost} invert />
              <Row name="Total cost" a={you.cost} b={ai.cost} invert />
              <Row name="Cost per unit" a={you.costPerUnit} b={ai.costPerUnit} fmt={v => v.toFixed(2)} invert />
              <Row name="Net" a={you.net} b={ai.net} />
              <Row name="Cost as % of revenue" a={you.margin * 100} b={ai.margin * 100} fmt={v => v.toFixed(1) + '%'} invert />
            </tbody>
          </table>
          <div className="note">Tonnage is capped by the day&rsquo;s energy. <b>Cost per unit</b> and <b>average grade</b> are where skill shows.</div>
        </details>

        <div className="note" style={{ color: 'var(--ok)' }}>Run saved to your history.</div>
        <button className="go" onClick={onAgain} autoFocus>Refit &amp; run again</button>
      </div>
    </div>
  );
}
