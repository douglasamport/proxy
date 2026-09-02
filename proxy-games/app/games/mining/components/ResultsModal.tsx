"use client";

import type { RunStatus, ScoreResult } from "@/lib/mining-engine";
import { Modal } from "@/app/games/mining/components/Modal";
import { ATOMS, SURFACE } from "@/lib/mining-theme";

const VERDICT: Record<string, [string, string]> = {
  banked: ["Run banked", ATOMS.textOk],
  stranded: ["Stranded — out of fuel", ATOMS.textDanger],
  wrecked: ["Wrecked — sink gone", ATOMS.textDanger],
};

function Delta({
  a,
  b,
  invert = false,
}: {
  a: number;
  b: number;
  invert?: boolean;
}) {
  if (!a && !b) return null;
  const diff = a - b,
    up = invert ? diff < 0 : diff > 0;
  if (Math.abs(diff) < 0.005)
    return <span className={ATOMS.textDimmer}>even</span>;
  return (
    <span className={up ? ATOMS.textOk : ATOMS.textDanger}>
      {diff > 0 ? "+" : ""}
      {diff.toFixed(diff % 1 ? 2 : 0)}
    </span>
  );
}

function Row({
  name,
  a,
  b,
  fmt = (v: number) => v.toFixed(0),
  invert = false,
}: {
  name: string;
  a: number;
  b: number;
  fmt?: (v: number) => string;
  invert?: boolean;
}) {
  return (
    <tr className={`border-t ${ATOMS.borderInset}`}>
      <td className={`py-1.5 pr-3 ${ATOMS.textDim}`}>{name}</td>
      <td className={`px-2 py-1.5 text-right font-mono ${ATOMS.textPrimary}`}>
        {fmt(a)}
      </td>
      <td className={`px-2 py-1.5 text-right font-mono ${ATOMS.textDim}`}>
        {fmt(b)}
      </td>
      <td className="py-1.5 pl-2 text-right font-mono text-[11px]">
        <Delta a={a} b={b} invert={invert} />
      </td>
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
  return (
    <div className="flex justify-between text-[11px]">
      <span className={ATOMS.textDim}>{name}</span>
      <b className={ATOMS.textPrimary}>-{amount.toFixed(0)}</b>
    </div>
  );
}

interface ResultsModalProps {
  status: RunStatus;
  seed: number;
  energyStart: number;
  you: ScoreResult;
  ai: ScoreResult;
  settling: boolean;
  onSettle: (choice: "credits" | "ore") => void;
}

// Everything here is what the server computed and returned from
// POST /api/runs/[id]/end — this component doesn't run score() or runAI()
// itself, since both need the seed, which the client only ever learns once
// the run is already over (see lib/mining-run-store.ts). The run itself
// isn't settled yet at this point — that happens once the player picks one
// of the two buttons below, via POST /api/runs/[id]/settle.
export function ResultsModal({
  status,
  seed,
  energyStart,
  you,
  ai,
  settling,
  onSettle,
}: ResultsModalProps) {
  const [vtxt, vcol] = VERDICT[status] || ["Run over", ATOMS.textDim];
  const netUp = you.net >= 0;

  return (
    <Modal wide>
      <div
        className={`font-mono text-sm font-bold uppercase tracking-wide ${vcol}`}
      >
        {vtxt}
      </div>
      <h2 className={`mt-1 text-[12px] ${ATOMS.textDim}`}>
        Run complete · seed {seed} · {energyStart}E claim
      </h2>

      <div className={`mt-4 rounded-lg ${SURFACE.card} p-4`}>
        <div className={SURFACE.label}>Manifest</div>
        <div className="mt-2 flex justify-between text-[11px]">
          <span className={ATOMS.textDim}>Ore income</span>
          <b className={ATOMS.textOk}>+{you.revenue.toFixed(0)}</b>
        </div>

        <div className={`mt-3 ${SURFACE.label}`}>Costs</div>
        <div className="mt-2 space-y-1">
          <CostLine name="Fuel" amount={you.fuelCost} />
          <CostLine name="Repair" amount={you.repair} />
          <CostLine name="Mobilisation fee" amount={you.launch} />
          <CostLine name="Claim" amount={you.claimCost} />
        </div>

        <div
          className={`mt-3 flex justify-between border-t ${ATOMS.borderInset} pt-2 text-sm`}
        >
          <span className={ATOMS.textPrimary}>Net</span>
          <b className={netUp ? ATOMS.textOk : ATOMS.textDanger}>
            {netUp ? "+" : ""}
            {you.net.toFixed(0)}
          </b>
        </div>
      </div>

      {you.lost > 0 && (
        <div className={`mt-3 text-[11px] ${ATOMS.textDanger}`}>
          Lost {you.lost} units in the field, plus the energy spent lifting
          them.
        </div>
      )}

      <details className="mt-4">
        <summary
          className={`cursor-pointer font-mono text-[11px] uppercase tracking-wider ${ATOMS.textDim}`}
        >
          Compare to autopilot
        </summary>
        <table className="mt-2 w-full text-[11px]">
          <thead>
            <tr className={ATOMS.textDimmer}>
              <th className="pb-1 text-left font-normal">Metric</th>
              <th className="pb-1 text-right font-normal">You</th>
              <th className="pb-1 text-right font-normal">Autopilot</th>
              <th className="pb-1"></th>
            </tr>
          </thead>
          <tbody>
            <Row
              name="Claim spent"
              a={you.claimSpent * 100}
              b={ai.claimSpent * 100}
              fmt={(v) => v.toFixed(0) + "%"}
            />
            <Row name="Units banked" a={you.units} b={ai.units} />
            <Row name="Trips" a={you.trips} b={ai.trips} invert />
            <Row
              name="Average grade"
              a={you.grade}
              b={ai.grade}
              fmt={(v) => v.toFixed(2)}
            />
            <Row name="Gross revenue" a={you.revenue} b={ai.revenue} />
            <Row name="Claim cost" a={you.claimCost} b={ai.claimCost} invert />
            <Row name="Total cost" a={you.cost} b={ai.cost} invert />
            <Row
              name="Cost per unit"
              a={you.costPerUnit}
              b={ai.costPerUnit}
              fmt={(v) => v.toFixed(2)}
              invert
            />
            <Row name="Net" a={you.net} b={ai.net} />
            <Row
              name="Cost as % of revenue"
              a={you.margin * 100}
              b={ai.margin * 100}
              fmt={(v) => v.toFixed(1) + "%"}
              invert
            />
          </tbody>
        </table>
      </details>

      <div className={`mt-4 text-[11px] ${ATOMS.textDim}`}>
        Keep the credits, or stockpile the ore itself for the refinery later —
        your call, per run.
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => onSettle("credits")}
          disabled={settling}
          autoFocus
          className={`rounded px-4 py-3 font-mono text-xs font-bold uppercase tracking-[.1em] transition disabled:opacity-50 ${SURFACE.btnPrimary}`}
        >
          Collect credits
        </button>
        <button
          onClick={() => onSettle("ore")}
          disabled={settling}
          className={`rounded border ${ATOMS.borderInset} px-4 py-3 font-mono text-xs font-bold uppercase tracking-[.1em] transition hover:bg-white/5 disabled:opacity-50 ${ATOMS.textPrimary}`}
        >
          Stockpile ore
        </button>
      </div>
    </Modal>
  );
}
