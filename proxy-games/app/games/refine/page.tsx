"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CFG,
  decantQuality,
  decantRatio,
  effectiveSinkRate,
  gradeTier,
  reservedOreUnits,
  tierTuning,
} from "@/lib/refine-engine";
import type { BatchState, BatchStatus } from "@/lib/refine-engine";
import type { OreTypeKey } from "@/lib/mining-engine";
import { ATOMS, ACCENTS, SURFACE } from "@/lib/mining-theme";

// Refinery v1 — see app/design_docs/minigame-v2-the-refinery.md. This is
// the first working pass at the batch screen: sizing (choose a mineral +
// bid) then the melt/vat/cool pipeline itself. Melt is a plain click here
// rather than a true press-and-hold gesture — the server-side engine
// already enforces melt's exclusivity (only one block can be melting at a
// time, see startMelt() in lib/refine-engine.ts) and drains the action bar
// for its full duration regardless of how the click happened, so the core
// "you cannot do anything else while melting" rule holds even though the
// input affordance is simplified for this first build.
const TICK_MS = 400;

// Real-world refined forms, matching db/016_refine_expansion.sql — kept
// here (not imported from lib/refine-inventory.ts) because that module
// pulls in the DB client, which has no business in a client bundle. Same
// reasoning as FLAT_SELL_PRICE_CATEGORIES in CatalogScreen.tsx.
const OUTPUT_LABELS: Record<OreTypeKey, string> = {
  copper: "Copper Cathode",
  zinc: "Zinc Ingot",
  iron: "Iron Ingot",
  silver: "Silver Bar",
  gold: "Gold Bar",
  platinum: "Platinum Ingot",
  silica: "Refined Silicon",
  germanium: "Germanium Ingot",
  cadmium: "Cadmium Ingot",
  neodymium: "Neodymium Oxide",
  yttrium: "Yttrium Oxide",
  lanthanum: "Lanthanum Oxide",
  tantalum: "Tantalum Powder",
};

interface OreOption {
  oreType: OreTypeKey;
  label: string;
  available: number;
}

interface FittingPayload {
  phase: "fitting";
  batchId: string;
  balance: string;
  oreOptions: OreOption[];
}
interface ActivePayload {
  phase: "active";
  batchId: string;
  state: BatchState;
  balance: string;
}
type CurrentPayload = FittingPayload | ActivePayload;

interface EndSummary {
  units: number;
  meanQuality: number;
  status: BatchStatus;
  orePerCathodeUnit: number | null;
}

async function postJSON<T>(
  url: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: await res.json() };
}

function round(n: number): number {
  return Math.round(n);
}

const ACTION_ERR_LABEL: Record<string, string> = {
  "not enough action charge": "Not enough action charge yet — wait for it to recharge.",
  "no slag to remove": "No slag to remove.",
  "not enough separated ore for a full unit": "Not enough separated ore for a full unit yet.",
  "already melting": "Already melting — wait for it to finish.",
  "no furnace equipped": "No furnace equipped.",
};

export default function RefinePage() {
  const [batchId, setBatchId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"fitting" | "active">("fitting");
  const [oreOptions, setOreOptions] = useState<OreOption[]>([]);
  const [selectedOreType, setSelectedOreType] = useState<OreTypeKey | null>(null);
  const [bidInput, setBidInput] = useState("100");
  const [state, setState] = useState<BatchState | null>(null);
  const [summary, setSummary] = useState<EndSummary | null>(null);
  const [error, setError] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [coolantCount, setCoolantCount] = useState(0);
  const [hasDecanterAuto, setHasDecanterAuto] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOwnedFlags = useCallback(async () => {
    const res = await fetch("/api/inventory?game=refine");
    if (!res.ok) return;
    const data = await res.json();
    const rows = data.inventory as { item_key: string; owned_quantity: number }[];
    setCoolantCount(rows.find((r) => r.item_key === "coolant_flush")?.owned_quantity ?? 0);
    setHasDecanterAuto(
      (rows.find((r) => r.item_key === "decanter_auto")?.owned_quantity ?? 0) > 0,
    );
  }, []);

  const resume = useCallback(async () => {
    const r = await postJSON<CurrentPayload>("/api/refine/current");
    if (!r.ok) return;
    setBatchId(r.data.batchId);
    setPhase(r.data.phase);
    if (r.data.phase === "fitting") {
      const options = r.data.oreOptions;
      setOreOptions(options);
      setSelectedOreType((prev) => prev ?? options[0]?.oreType ?? null);
    } else {
      setState(r.data.state);
      fetchOwnedFlags();
    }
  }, [fetchOwnedFlags]);

  const didLoadRef = useRef(false);
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    resume();
  }, [resume]);

  // Poll for real-time progress (melt completion, separation, pressure
  // drift, forced vent, overheat) while a batch is active and hasn't ended.
  useEffect(() => {
    if (phase !== "active" || !batchId || summary) return;
    pollRef.current = setInterval(async () => {
      const r = await postJSON<{ state: BatchState }>(
        `/api/refine/${batchId}/tick`,
      );
      if (r.ok) setState(r.data.state);
    }, TICK_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [phase, batchId, summary]);

  // A batch can go terminal (overheat) from a plain tick, with no explicit
  // shutdown click — without this, the UI would just keep polling a dead
  // batch forever and never show a result. Mirrors mining's equivalent
  // auto-end effect.
  const endingRef = useRef(false);
  useEffect(() => {
    if (!state || state.status === "active" || summary || endingRef.current) {
      return;
    }
    endingRef.current = true;
    endBatch().finally(() => {
      endingRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, summary]);

  async function launch() {
    if (!batchId || !selectedOreType) return;
    const bidUnits = Math.floor(Number(bidInput));
    if (!Number.isFinite(bidUnits) || bidUnits <= 0) {
      setError("Enter a valid ore bid.");
      return;
    }
    setBusy(true);
    setError("");
    const r = await postJSON<{ state: BatchState }>(
      `/api/refine/${batchId}/launch`,
      { bidUnits, oreType: selectedOreType },
    );
    setBusy(false);
    if (!r.ok) {
      setError(
        r.status === 402
          ? "Not enough ore for that bid."
          : r.status === 400
            ? "No furnace equipped — visit the store."
            : "Could not launch — try again.",
      );
      return;
    }
    setPhase("active");
    setState(r.data.state);
    fetchOwnedFlags();
  }

  // Every lane action reports back whether it actually did anything — a
  // silent no-op (insufficient action charge, nothing to remove/decant)
  // used to look identical to a broken button. Surfaced here instead.
  const act = useCallback(
    async (path: string, body?: unknown) => {
      if (!batchId) return;
      const r = await postJSON<{ state: BatchState; err?: string }>(
        `/api/refine/${batchId}/${path}`,
        body,
      );
      if (!r.ok) return;
      setState(r.data.state);
      setActionErr(
        r.data.err ? (ACTION_ERR_LABEL[r.data.err] ?? r.data.err) : "",
      );
    },
    [batchId],
  );

  async function setFinPower(power: number) {
    if (!batchId) return;
    const r = await postJSON<{ state: BatchState }>(
      `/api/refine/${batchId}/fins`,
      { power },
    );
    if (r.ok) setState(r.data.state);
  }

  async function setHeaterRate(rate: number) {
    if (!batchId) return;
    const r = await postJSON<{ state: BatchState }>(
      `/api/refine/${batchId}/heater`,
      { rate },
    );
    if (r.ok) setState(r.data.state);
  }

  async function vent(amount: number) {
    return act("vent", { amount });
  }

  async function useCoolant() {
    if (!batchId || coolantCount <= 0) return;
    const r = await postJSON<{ state: BatchState; err?: string }>(
      `/api/refine/${batchId}/coolant`,
    );
    if (!r.ok) return;
    setState(r.data.state);
    if (!r.data.err) setCoolantCount((n) => Math.max(0, n - 1));
  }

  async function decantAll() {
    if (!batchId || !hasDecanterAuto) return;
    const r = await postJSON<{ state: BatchState; err?: string }>(
      `/api/refine/${batchId}/decant-all`,
    );
    if (!r.ok) return;
    setState(r.data.state);
    setActionErr(r.data.err ? (ACTION_ERR_LABEL[r.data.err] ?? r.data.err) : "");
  }

  async function endBatch() {
    if (!batchId) return;
    const r = await postJSON<{ state: BatchState; summary?: EndSummary }>(
      `/api/refine/${batchId}/end`,
    );
    if (!r.ok) return;
    setState(r.data.state);
    if (r.data.summary) setSummary(r.data.summary);
  }

  async function playAgain() {
    const r = await postJSON<FittingPayload>("/api/refine/new");
    if (!r.ok) return;
    setBatchId(r.data.batchId);
    setOreOptions(r.data.oreOptions);
    setSelectedOreType(r.data.oreOptions[0]?.oreType ?? null);
    setPhase("fitting");
    setState(null);
    setSummary(null);
  }

  if (phase === "fitting") {
    const selected = oreOptions.find((o) => o.oreType === selectedOreType);
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1
          className={`mb-1 font-mono text-lg font-bold uppercase tracking-wide ${ATOMS.textPrimary}`}
        >
          Size the batch
        </h1>
        <p className={`mb-6 text-sm ${ATOMS.textDim}`}>
          Choose which mineral to refine and how much to commit. Rarer ore
          pays out at a much wider decant range — 5 ore/unit at best, up to
          100 at worst — and demands tighter heat/pressure/slag control.
          Once launched, unmelted ore returns to you on a deliberate
          shutdown, but is destroyed on an overheat.
        </p>

        <label className={`${SURFACE.label} mb-1 block`}>mineral</label>
        <select
          value={selectedOreType ?? ""}
          onChange={(e) => setSelectedOreType(e.target.value as OreTypeKey)}
          className={`mb-4 w-full rounded border ${ATOMS.borderLine} bg-transparent px-3 py-2 font-mono text-sm ${ATOMS.textPrimary}`}
        >
          {oreOptions.map((o) => (
            <option key={o.oreType} value={o.oreType} className="bg-black">
              {o.label} ({o.available.toLocaleString()} available)
            </option>
          ))}
        </select>

        <div className={`mb-4 rounded-lg p-4 ${SURFACE.well}`}>
          <div className={`${SURFACE.label} mb-1`}>available ore</div>
          <div className={`font-mono text-2xl font-bold ${ATOMS.textPrimary}`}>
            {(selected?.available ?? 0).toLocaleString()}
          </div>
        </div>

        {error && (
          <div className={`mb-4 text-sm ${ATOMS.textDanger}`}>{error}</div>
        )}

        <label className={`${SURFACE.label} mb-1 block`}>batch bid</label>
        <input
          type="number"
          value={bidInput}
          onChange={(e) => setBidInput(e.target.value)}
          className={`mb-4 w-full rounded border ${ATOMS.borderLine} bg-transparent px-3 py-2 font-mono text-sm ${ATOMS.textPrimary}`}
        />

        <button
          onClick={launch}
          disabled={busy || !selectedOreType}
          className={`w-full rounded px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider ${ATOMS.textVoid} ${ACCENTS.equipment.btn} ${SURFACE.btnDisabled} transition hover:brightness-110`}
        >
          {busy ? "…" : "Launch batch"}
        </button>
      </main>
    );
  }

  if (!state) {
    return <main className="px-6 py-16 text-center">Loading…</main>;
  }

  const tuning = tierTuning(state.oreType);
  const outputLabel = OUTPUT_LABELS[state.oreType];
  const heatIdealHigh = tuning.heatIdealFraction * CFG.TANK_HEAT_CEILING;
  const pressureLow = 50 - tuning.pressureHalfWidth;
  const pressureHigh = 50 + tuning.pressureHalfWidth;

  const tankCapacity = state.rig.tankCapacity || 100;
  // Three non-overlapping buckets that sum to the total: "mixed" is ore a
  // melt just dumped in that hasn't separated yet (state.tankOre); slag and
  // ready ore are what it resolves into. Previously "mixed" also included
  // tankSlag, which double-counted it against the separate slag gauge and
  // broke total = mixed + slag + ready.
  const totalVolume = state.tankOre + state.tankSlag + state.readyOre;
  const slagFraction = totalVolume > 0 ? state.tankSlag / totalVolume : 0;
  const slagPercent = slagFraction * 100;
  // Percentage-scaled (0-100), not absolute units against tankCapacity —
  // the ideal band is a *fraction of current volume* (§4.6), and scaling
  // the bar to an ever-larger tank capacity shrank a genuinely healthy
  // slag level down to an unreadable sliver. Mirrors decantQuality()'s own
  // slagScore curve for this batch's tier: target 15%, scoring 0 by the
  // time the fraction drifts 3x the tier's slagHalfWidth away.
  const slagIdealBand = {
    low: (0.15 - tuning.slagHalfWidth) * 100,
    high: (0.15 + tuning.slagHalfWidth) * 100,
    max: (0.15 + tuning.slagHalfWidth * 3) * 100,
  };
  const quality = decantQuality(state.heat, state.pressure, slagFraction, tuning);
  const ratio = decantRatio(quality, tuning);

  // Displayed separately from the precise values above: each gauge used to
  // round its own number independently (mixed, slag, ready ore), so their
  // displayed sum didn't reliably match the displayed total volume —
  // rounding 0.4/1.3/5.4 to 0/1/5 (sum 6) while the total rounds 7.1 to 7
  // is correct per-number and inconsistent together. Rounding the parts
  // first and deriving the total from those same rounded parts guarantees
  // what's on screen always adds up, at the cost of the total's own last
  // half-unit of precision.
  const mixedDisplay = Math.round(state.tankOre);
  const slagDisplay = Math.round(state.tankSlag);
  const readyOreDisplay = Math.round(state.readyOre);
  const totalVolumeDisplay = mixedDisplay + slagDisplay + readyOreDisplay;
  const sinkRate = effectiveSinkRate(
    state.rig,
    state.tankSlag,
    state.finPower,
    state.dumping,
    state.coolerStored,
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className={`mb-4 font-mono text-xs uppercase tracking-wider ${ATOMS.textDim}`}>
        Refining <span className={ATOMS.textPrimary}>{outputLabel}</span>
      </div>

      {!summary && (
        <div
          className={`mb-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg p-3 text-[11px] sm:grid-cols-4 ${SURFACE.well}`}
        >
          <div>
            <span className={ATOMS.textDim}>heat target </span>
            <span className={`font-mono ${ATOMS.textPrimary}`}>
              0-{round(heatIdealHigh)}
            </span>
          </div>
          <div>
            <span className={ATOMS.textDim}>pressure target </span>
            <span className={`font-mono ${ATOMS.textPrimary}`}>
              {round(pressureLow)}-{round(pressureHigh)}
            </span>
          </div>
          <div>
            <span className={ATOMS.textDim}>slag target </span>
            <span className={`font-mono ${ATOMS.textPrimary}`}>
              {round((0.15 - tuning.slagHalfWidth) * 100)}-
              {round((0.15 + tuning.slagHalfWidth) * 100)}% of volume
            </span>
          </div>
          <div>
            <span className={ATOMS.textDim}>decant target </span>
            <span className={`font-mono ${ATOMS.textPrimary}`}>
              {CFG.DECANT_ORE_BEST}-{tuning.decantOreWorst} ore/unit
            </span>
          </div>
        </div>
      )}

      {showHelp && !summary && (
        <div
          className={`mb-6 rounded-lg p-4 text-[12px] leading-relaxed ${SURFACE.well} ${ATOMS.textDim}`}
        >
          <button
            onClick={() => setShowHelp(false)}
            className={`float-right font-mono text-[10px] uppercase ${ATOMS.textDim} transition hover:text-white`}
          >
            dismiss
          </button>
          <strong className={ATOMS.textPrimary}>How this works:</strong> Melt
          a block (furnace) to load ore + slag into the vat. Ore separates
          into <em>ready ore</em> on its own over a few seconds — faster
          when pressure sits at or below the optimal band; riding pressure
          higher (without tipping into a forced vent) actually improves
          your decant ratio, so the <strong>vat heater</strong> is there to
          let you deliberately push heat — and with it, pressure — up on
          purpose, not just as a melt byproduct (its floor, and the{" "}
          <strong>vent valve</strong>&rsquo;s range, are set by whichever
          heater/valve you have equipped — better ones reach lower).{" "}
          <strong>Vent</strong> and <strong>remove slag</strong> keep both
          from running away; ignoring them makes the vat harder to cool.
          Turn on <strong>dump</strong> to pull heat into the sink, and the
          equipped <strong>radiator</strong> is what actually sheds it to
          the outside world afterward — a bigger sink fills faster without
          a better radiator to empty it back out. <strong>Decant</strong>{" "}
          converts ready ore into banked output; better conditions mean more
          units per ore spent — <strong>Decant All</strong> (if unlocked)
          banks everything currently affordable in one click instead of one
          unit at a time. Rarer minerals demand tighter control and punish a
          bad decant far harder. Ending the batch keeps whatever&rsquo;s
          banked; a deliberate shutdown also returns unmelted ore, an
          overheat destroys it.
          <div className="mt-2">
            Heat/pressure/slag bars are colored by distance from ideal:{" "}
            <span className="text-[#3B82F6]">blue</span>/
            <span className="text-[#22D3EE]">aqua</span> = under,{" "}
            <span className="text-[#22C55E]">green</span> = ideal,{" "}
            <span className="text-[#EAB308]">yellow</span>/
            <span className="text-[#EF4444]">red</span> = over.
          </div>
        </div>
      )}

      {summary && (
        <div className={`mb-6 rounded-lg p-5 ${SURFACE.well}`}>
          <div
            className={`mb-2 font-mono text-sm font-bold uppercase ${
              summary.status === "overheat" ? ATOMS.textDanger : ATOMS.textOk
            }`}
          >
            Batch {summary.status}
          </div>
          <div className={`mb-4 text-sm ${ATOMS.textDim}`}>
            {summary.units} {outputLabel} banked, mean decant quality{" "}
            {(summary.meanQuality * 100).toFixed(0)}%
            {summary.orePerCathodeUnit !== null &&
              ` (${summary.orePerCathodeUnit.toFixed(1)} ore/unit overall)`}
            {summary.status === "shutdown" &&
              state.oreRemaining > 0 &&
              ` — ${round(state.oreRemaining)} unmelted ore returned`}
          </div>
          <button
            onClick={playAgain}
            className={`rounded px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider ${ATOMS.textVoid} ${ACCENTS.equipment.btn} transition hover:brightness-110`}
          >
            New batch
          </button>
        </div>
      )}

      {!summary && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            {/* Offer / melt lanes */}
            <section>
              <div className={`${SURFACE.label} mb-2`}>furnace — offer</div>
              <div className="grid grid-cols-3 gap-3">
                {state.offer.map((slot, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 ${SURFACE.card} ${SURFACE.cardShadowSm}`}
                  >
                    {slot.block ? (
                      <>
                        <div
                          className={`font-mono text-xl font-bold ${ATOMS.textPrimary}`}
                        >
                          {slot.block.revealed
                            ? `G${gradeTier(slot.block.grade)}`
                            : slot.block.assayStartedAt !== null
                              ? "…"
                              : "?"}
                        </div>
                        {slot.block.revealed && (
                          <div className={`text-[10px] ${ATOMS.textDim}`}>
                            {slot.block.oreUnits} ore /{" "}
                            {slot.block.slagUnits.toFixed(1)} slag
                          </div>
                        )}
                        <div className="mt-2 flex gap-1">
                          <button
                            onClick={() => act("assay", { slotIndex: i })}
                            disabled={
                              !!state.melting ||
                              slot.block.revealed ||
                              slot.block.assayStartedAt !== null
                            }
                            className={`flex-1 rounded border ${ATOMS.borderLine} px-2 py-1 text-[10px] uppercase ${ATOMS.textDim} ${SURFACE.btnDisabled} transition hover:bg-white/5`}
                          >
                            Assay
                          </button>
                          <button
                            onClick={() => act("melt", { slotIndex: i })}
                            disabled={!!state.melting}
                            className={`flex-1 rounded px-2 py-1 text-[10px] font-bold uppercase ${ATOMS.textVoid} ${ACCENTS.consumable.btn} ${SURFACE.btnDisabled} transition`}
                          >
                            {state.melting?.slotIndex === i
                              ? "Melting…"
                              : "Melt"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className={`text-xs ${ATOMS.textDim}`}>
                        {slot.refillReadyAt === null &&
                        state.oreRemaining - reservedOreUnits(state.offer) <= 0
                          ? "no more ore"
                          : "refilling…"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className={`mt-2 text-[11px] ${ATOMS.textDim}`}>
                ore remaining in bid: {round(state.oreRemaining)}
              </div>
            </section>

            {/* Vat */}
            <section className={`rounded-lg p-4 ${SURFACE.well}`}>
              <div className={`${SURFACE.label} mb-3`}>vat</div>

              <div className="mb-3 grid grid-cols-2 gap-3">
                <Gauge
                  label="total volume"
                  value={totalVolumeDisplay}
                  max={tankCapacity}
                  danger
                />
                <Gauge
                  label="mixed (unseparated)"
                  value={mixedDisplay}
                  max={tankCapacity}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Gauge
                  label="heat"
                  value={state.heat}
                  max={CFG.TANK_HEAT_CEILING}
                  ideal={{ low: 0, high: heatIdealHigh, max: CFG.TANK_HEAT_CEILING }}
                />
                <Gauge
                  label="pressure"
                  value={state.pressure}
                  max={CFG.PRESSURE_FORCED_VENT}
                  ideal={{
                    low: pressureLow,
                    high: pressureHigh,
                    max: CFG.PRESSURE_FORCED_VENT,
                  }}
                />
                <Gauge
                  label="slag"
                  value={slagPercent}
                  max={100}
                  unit="%"
                  note={`${slagDisplay} units`}
                  ideal={slagIdealBand}
                />
                <Gauge
                  label="ready ore"
                  value={readyOreDisplay}
                  max={tankCapacity}
                />
              </div>

              {actionErr && (
                <div className={`mt-3 text-[11px] ${ATOMS.textDanger}`}>
                  {actionErr}
                </div>
              )}

              <div className={`${SURFACE.label} mt-4 mb-1`}>
                vent (valve range: {state.rig.ventMin}-{state.rig.ventMax})
              </div>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  onClick={() => vent(state.rig.ventMax)}
                  className={`rounded border ${ATOMS.borderLine} px-3 py-1.5 text-[11px] uppercase ${ATOMS.textDim} ${SURFACE.btnDisabled} transition hover:bg-white/5`}
                >
                  Vent (-{state.rig.ventMax})
                </button>
                <button
                  onClick={() => vent(state.rig.ventMin)}
                  disabled={state.rig.ventMin === state.rig.ventMax}
                  className={`rounded border ${ATOMS.borderLine} px-3 py-1.5 text-[11px] uppercase ${ATOMS.textDim} ${SURFACE.btnDisabled} transition hover:bg-white/5`}
                >
                  Vent (-{state.rig.ventMin})
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => act("remove-slag")}
                  disabled={state.tankSlag <= 0}
                  className={`rounded border ${ATOMS.borderLine} px-3 py-1.5 text-[11px] uppercase ${ATOMS.textDim} ${SURFACE.btnDisabled} transition hover:bg-white/5`}
                >
                  Remove slag (-{CFG.REMOVE_SLAG_AMOUNT})
                </button>
                <button
                  onClick={() => act("dump")}
                  className={
                    state.dumping
                      ? `rounded px-3 py-1.5 text-[11px] font-bold uppercase ${ATOMS.textVoid} ${ACCENTS.equipment.btn} transition hover:brightness-110`
                      : `rounded border ${ATOMS.borderLine} px-3 py-1.5 text-[11px] font-bold uppercase ${ATOMS.textDim} transition hover:bg-white/5`
                  }
                >
                  {state.dumping ? "Dumping to cooler" : "Dump heat: off"}
                </button>
                <button
                  onClick={() => act("decant")}
                  disabled={
                    state.readyOre < ratio ||
                    state.actionCharge < CFG.ACTION_COST_DECANT
                  }
                  className={`rounded px-3 py-1.5 text-[11px] font-bold uppercase ${ATOMS.textVoid} ${ACCENTS.expansion.btn} ${SURFACE.btnDisabled} transition hover:brightness-110`}
                >
                  Decant 1 unit ({round(ratio)} ore)
                </button>
                {hasDecanterAuto && (
                  <button
                    onClick={decantAll}
                    disabled={
                      state.readyOre < ratio ||
                      state.actionCharge < CFG.ACTION_COST_DECANT
                    }
                    className={`rounded px-3 py-1.5 text-[11px] font-bold uppercase ${ATOMS.textVoid} ${ACCENTS.expansion.btn} ${SURFACE.btnDisabled} transition hover:brightness-110`}
                  >
                    Decant All
                  </button>
                )}
              </div>

              <label
                className={`mt-4 block text-[10px] uppercase tracking-wider ${ATOMS.textDim}`}
              >
                vat heater — {round(state.heaterRate)}u/sec (
                {state.rig.heaterMin}-{state.rig.heaterMax} range)
              </label>
              <input
                type="range"
                min={state.rig.heaterMin}
                max={state.rig.heaterMax}
                value={state.heaterRate}
                onChange={(e) => setHeaterRate(Number(e.target.value))}
                className="mt-1 w-full"
              />
              <p className={`mt-1 text-[10px] ${ATOMS.textDim}`}>
                A standing heat source, always on — raise it to push heat
                (and pressure) up deliberately instead of relying on melts
                alone.
              </p>
            </section>

            {/* Cooler */}
            <section className={`rounded-lg p-4 ${SURFACE.well}`}>
              <div className={`${SURFACE.label} mb-3`}>cooler</div>
              <Gauge
                label="stored heat"
                value={state.coolerStored}
                max={CFG.COOLER_CAPACITY}
                danger
              />
              <div className={`mt-3 text-[11px] ${ATOMS.textDim}`}>
                sinking{" "}
                <span className={ATOMS.textPrimary}>{sinkRate.toFixed(1)}</span>{" "}
                heat/sec
                {!state.dumping && " — turn on dump to start shedding heat"}
              </div>
              <div className={`mt-1 text-[11px] ${ATOMS.textDim}`}>
                radiator sheds{" "}
                <span className={ATOMS.textPrimary}>
                  {state.rig.dissipationRate}
                </span>{" "}
                heat/sec to ambient, always — this is the only thing that
                actually drains the sink itself, independent of dumping
              </div>

              <label
                className={`mt-3 block text-[10px] uppercase tracking-wider ${ATOMS.textDim}`}
              >
                fin power — {Math.round(state.finPower * 100)}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(state.finPower * 100)}
                onChange={(e) => setFinPower(Number(e.target.value))}
                className="mt-1 w-full"
              />

              <button
                onClick={useCoolant}
                disabled={coolantCount <= 0}
                className={`mt-3 w-full rounded border ${ATOMS.borderLine} px-3 py-1.5 text-[11px] font-bold uppercase ${ATOMS.textDim} ${SURFACE.btnDisabled} transition hover:bg-white/5`}
              >
                Use Coolant Flush ({coolantCount} owned)
              </button>
            </section>
          </div>

          <div className="space-y-6">
            <section className={`rounded-lg p-4 ${SURFACE.well}`}>
              <div className={`${SURFACE.label} mb-2`}>action charge</div>
              <Gauge value={state.actionCharge} max={CFG.ACTION_CAP} />
            </section>

            <section className={`rounded-lg p-4 ${SURFACE.well}`}>
              <div className={`${SURFACE.label} mb-2`}>banked</div>
              <div
                className={`font-mono text-2xl font-bold ${ATOMS.textPrimary}`}
              >
                {state.bankedUnits}
              </div>
              <div className={`text-[11px] ${ATOMS.textDim}`}>
                {outputLabel} · {state.decants} decants · {state.forcedVents}{" "}
                forced vents
              </div>
            </section>

            <button
              onClick={endBatch}
              className={`w-full rounded border ${ATOMS.borderLine} px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider ${ATOMS.textDim} transition hover:bg-white/5`}
            >
              Shut down batch
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// A gauge's "ideal" range — the band that scores best mechanically (§4.9's
// decant quality, or separation's own optimum). `low`/`high` bound that
// green zone; `min`/`max` bound the full scale the under/over gradient
// stretches across. `min` defaults to 0 — for a value with no genuine
// "too little" penalty (heat), leave `low` at 0 too, so the under-ideal
// (blue/aqua) half of the scale simply never triggers.
interface IdealBand {
  low: number;
  high: number;
  min?: number;
  max: number;
}

// Five fixed, literal class strings (not built via interpolation) so
// Tailwind's static scanner can find them — see the comment on
// EXPANSION_KEY in components/game-shell/CatalogScreen.tsx for the same
// reasoning applied elsewhere in this codebase.
const ZONE_BLUE = "bg-[#3B82F6]";
const ZONE_AQUA = "bg-[#22D3EE]";
const ZONE_GREEN = "bg-[#22C55E]";
const ZONE_YELLOW = "bg-[#EAB308]";
const ZONE_RED = "bg-[#EF4444]";
const ZONE_DEFAULT = "bg-[#54C6DC]";
const ZONE_DANGER = "bg-[#D9564F]";

// Blue (far under) -> aqua (near, from below) -> green (in the ideal band)
// -> yellow (near, from above) -> red (far over) — a discrete 5-stop read
// of "how close to ideal," not a continuous gradient, so it stays legible
// as a glance rather than a color-theory exercise.
function zoneColor(value: number, band: IdealBand): string {
  const min = band.min ?? 0;
  if (value < band.low) {
    const span = band.low - min;
    const t = span > 0 ? Math.min(1, Math.max(0, (value - min) / span)) : 1;
    return t > 0.5 ? ZONE_AQUA : ZONE_BLUE;
  }
  if (value <= band.high) return ZONE_GREEN;
  const span = band.max - band.high;
  const t = span > 0 ? Math.min(1, Math.max(0, (value - band.high) / span)) : 1;
  return t > 0.5 ? ZONE_RED : ZONE_YELLOW;
}

function Gauge({
  label,
  value,
  max,
  danger,
  ideal,
  unit,
  note,
}: {
  label?: string;
  value: number;
  max: number;
  danger?: boolean;
  /** When set, the fill reads as distance-from-ideal (see zoneColor)
   *  instead of the plain fullness-based danger coloring. */
  ideal?: IdealBand;
  /** Appended to both numbers in the footer, e.g. "%". */
  unit?: string;
  /** Extra line under the footer — e.g. the same quantity in different
   *  units (slag shown as % of volume needs the absolute unit count too,
   *  since the fraction alone is what's mechanically meaningful but the
   *  raw count is what the "remove slag" button actually consumes). */
  note?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const fill = ideal
    ? zoneColor(value, ideal)
    : danger && pct > 80
      ? ZONE_DANGER
      : ZONE_DEFAULT;
  return (
    <div>
      {label && <div className={`text-[10px] ${ATOMS.textDim}`}>{label}</div>}
      <div className={`h-2 w-full overflow-hidden rounded ${ATOMS.bgDisabled}`}>
        <div className={`h-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`mt-0.5 font-mono text-[10px] ${ATOMS.textDim}`}>
        {round(value)}
        {unit} / {round(max)}
        {unit}
      </div>
      {note && (
        <div className={`font-mono text-[10px] ${ATOMS.textDim}`}>{note}</div>
      )}
    </div>
  );
}
