"use client";

import { CFG, fuelMult } from "@/lib/mining-engine";
import type { Chassis, SurveyReport, SurveyTier } from "@/lib/mining-engine";
import { StatsPanel } from "@/app/games/mining/components/StatsPanel";
import { ACCENTS, ATOMS, SURFACE, type Accent } from "@/lib/mining-theme";

// Presets used to double as one-click Alloc pickers back when the chassis
// was a per-run 10-slot allocation. Loadouts are now owned inventory
// (see the dedicated build screen), so these aren't wired to anything —
// kept for whenever preset *loadouts* (bundles of owned-item picks) get
// rebuilt on top of the new system.
// export const PRESETS: [string, Alloc, string][] = [
//   ['Balanced',   {fuel:4,cargo:3,armour:2,drive:3,steer:2,sensor:2,analyser:0}, 'The reference rig. Nothing outstanding, nothing missing.'],
//   ['Hauler',     {fuel:3,cargo:6,armour:2,drive:2,steer:1,sensor:2,analyser:0}, 'Huge hold, few hauls. Best cost per unit on small claims, strands on big ones.'],
//   ['Surveyor',   {fuel:4,cargo:2,armour:2,drive:2,steer:1,sensor:4,analyser:1}, 'Sees furthest and reads it best. Small hold, so it works what it finds carefully.'],
//   ['Deep shaft', {fuel:6,cargo:3,armour:1,drive:2,steer:1,sensor:2,analyser:1}, 'Maximum tank, minimum plate. Goes furthest, wrecks most.'],
//   ['Sprinter',   {fuel:4,cargo:2,armour:1,drive:5,steer:2,sensor:2,analyser:0}, 'Cheap ground, thin everything else. Covers distance, not hazard.'],
//   ['Weaver',     {fuel:3,cargo:3,armour:2,drive:2,steer:4,sensor:2,analyser:0}, 'Turns for almost nothing. Picks its way through scattered pockets.'],
//   ['Deepcore',   {fuel:4,cargo:3,armour:4,drive:2,steer:1,sensor:2,analyser:0}, 'Heavy plate. Cuts through gas and hard ground others must route around.'],
//   ['Blind dig',  {fuel:5,cargo:4,armour:3,drive:2,steer:2,sensor:0,analyser:0}, 'No sensors at all. Everything in the hull, nothing in the eyes. Pure nerve.']
// ];

// 'none' isn't a purchasable tier — it's just the default before anything's bought.
const SURVEY_TIERS: ("basic" | "full")[] = ["basic", "full"];

interface FittingPanelProps {
  chassis: Chassis;
  claim: number;
  survey: SurveyTier;
  report: SurveyReport | null;
  balance: string | null;
  runId: string | null;
  // Field size for this player's unlocked minerals — computed server-side
  // (see fieldDims() in lib/mining-engine.ts) since it depends on license
  // ownership, not anything the client can derive on its own. Falls back to
  // the base map size until the parent's fetch resolves.
  dims: { W: number; H: number };
  onClaimChange: (claim: number) => void;
  onRequestSurvey: (tier: "basic" | "full") => void;
  onLaunch: () => void;
}

// Purchase chip — same visual language as FilterBar's option buttons, but
// with per-option affordability (FilterBar's options don't support a
// disabled state, since it's built for pure filtering, not spending money).
function BuyChip({
  label,
  sub,
  on,
  disabled,
  accent,
  onClick,
}: {
  label: string;
  sub?: string;
  on: boolean;
  disabled: boolean;
  accent: Accent;
  onClick: () => void;
}) {
  const a = ACCENTS[accent];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 rounded border px-3 py-2 text-center font-mono text-xs uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? `${a.border} ${a.tintBg} ${a.text}` : SURFACE.filterInactive
      }`}
    >
      <div className="font-bold">{label}</div>
      {sub && (
        <div
          className={`mt-0.5 text-[10px] normal-case ${on ? "opacity-80" : ATOMS.textDimmer}`}
        >
          {sub}
        </div>
      )}
    </button>
  );
}

// Order matches the decisions a player actually makes, in order: the field
// is assigned (server-side, before this component ever mounts), then buy a
// survey or skip it, then buy a claim size, then check the chassis (fitted
// out ahead of time on the dedicated build screen), then launch.
export function FittingPanel({
  chassis: ch,
  claim,
  survey,
  report,
  balance,
  runId,
  dims,
  onClaimChange,
  onRequestSurvey,
  onLaunch,
}: FittingPanelProps) {
  const claimCost = CFG.CLAIM_COST[claim] ?? 0;
  const funds = balance ? Number(balance) : 0;

  const mult = fuelMult(ch);
  const chassisRows = [
    { label: "Hold per trip", value: `${ch.hold}u` },
    { label: "Fuel capacity", value: ch.fuelCap.toFixed(0) },
    {
      label: "Dig a fresh cell",
      value: ((1 / ch.speed + CFG.DIG_FUEL) * mult).toFixed(2),
    },
    {
      label: "Drive a tunnel",
      value: ((1 / ch.speed) * CFG.TUNNEL_MULT * mult).toFixed(2),
    },
    {
      label: "Turn surcharge",
      value: ((CFG.TURN_BASE / ch.movement) * mult).toFixed(2),
    },
    {
      label: "Fresh digs available",
      value: `~${Math.floor(ch.fuelCap / ((1 / ch.speed + CFG.DIG_FUEL) * mult))}`,
    },
    { label: "Sink", value: String(ch.sinkCap) },
    { label: "Ping range", value: `${ch.sensorRange.toFixed(1)} cells` },
    { label: "Fix accuracy", value: `±${ch.sensorBlur.toFixed(1)}` },
    { label: "Ping cost", value: `${ch.pingFuel.toFixed(1)} fuel` },
    {
      label: "Grade estimate",
      value: `±${(ch.analyser / 2).toFixed(1)} tiers`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className={`rounded-lg ${SURFACE.card} p-4`}>
        <div className={SURFACE.label}>Survey</div>
        <div className="mt-2 flex gap-2">
          {SURVEY_TIERS.map((k) => (
            <BuyChip
              key={k}
              label={CFG.SURVEY[k].label}
              sub={CFG.SURVEY[k].cost ? `${CFG.SURVEY[k].cost}cr` : undefined}
              on={k === survey}
              disabled={k !== survey && CFG.SURVEY[k].cost > funds}
              accent="equipment"
              onClick={() => onRequestSurvey(k)}
            />
          ))}
        </div>
        <p className={`mt-2 text-[11px] leading-snug ${ATOMS.textDim}`}>
          {CFG.SURVEY[survey].note}
          {CFG.SURVEY[survey].cost ? (
            <>
              {" "}
              <b className={ATOMS.textPrimary}>{CFG.SURVEY[survey].cost}</b>.
            </>
          ) : null}
        </p>
        <ReportPanel survey={survey} report={report} />
      </div>

      <div className={`rounded-lg ${SURFACE.card} p-4`}>
        <div className={SURFACE.label}>
          Claim for this run · max {CFG.ENERGY_MAX}
        </div>
        <div className="mt-2 flex gap-2">
          {CFG.CLAIM_OPTIONS.map((v) => (
            <BuyChip
              key={v}
              label={`${v}E`}
              sub={`${CFG.CLAIM_COST[v]}cr`}
              on={v === claim}
              disabled={v !== claim && CFG.CLAIM_COST[v] > funds}
              accent="expansion"
              onClick={() => onClaimChange(v)}
            />
          ))}
        </div>
        <p className={`mt-2 text-[11px] leading-snug ${ATOMS.textDim}`}>
          Claiming this size costs{" "}
          <b className={ATOMS.textPrimary}>{claimCost}</b>, deducted from this
          run&rsquo;s net at the end. Freely changeable until you launch.
        </p>
        <div
          className={`mt-3 space-y-1 border-t ${ATOMS.borderInset} pt-2 text-[11px]`}
        >
          <div className="flex justify-between">
            <span className={ATOMS.textDim}>Target</span>
            <b className={ATOMS.textPrimary}>{claim}u of ore</b>
          </div>
          <div className="flex justify-between">
            <span className={ATOMS.textDim}>Claim cost</span>
            <b className={ATOMS.textPrimary}>{claimCost}</b>
          </div>
          <div className="flex justify-between">
            <span className={ATOMS.textDim}>Hauls to carry it</span>
            <b className={ATOMS.textPrimary}>~{Math.ceil(claim / ch.hold)}</b>
          </div>
          <div className="flex justify-between">
            <span className={ATOMS.textDim}>Site size</span>
            <b className={ATOMS.textPrimary}>
              {dims.W} × {dims.H}
            </b>
          </div>
        </div>
      </div>

      <div>
        <StatsPanel title="Chassis" rows={chassisRows} />
        <p className={`mt-2 text-[11px] leading-snug ${ATOMS.textDim}`}>
          Whatever&rsquo;s equipped on your{" "}
          <a href="/games/mining/build" className={ATOMS.textTeal}>
            build screen
          </a>{" "}
          right now. Fit changes there carry into your next launch.
        </p>
        <a
          href="/games/mining/build"
          className={`mt-2 block rounded border ${ATOMS.borderLine} px-3 py-1.5 text-center font-mono text-[10px] uppercase tracking-[.12em] ${ATOMS.textDim} transition ${SURFACE.navLinkHover}`}
        >
          Edit loadout
        </a>
      </div>

      <button
        onClick={onLaunch}
        disabled={!runId}
        className={`w-full rounded px-5 py-3 font-mono text-xs font-bold uppercase tracking-[.14em] transition ${SURFACE.btnPrimary} ${SURFACE.btnDisabled}`}
      >
        Launch run
      </button>
    </div>
  );
}

// Purely presentational now — the report comes from whatever the last
// successful purchase returned (see SurveyPurchaseModal / page.tsx). No
// self-fetching: there's nothing to preview for free anymore, a tier isn't
// "selected", it's bought.
function ReportPanel({
  survey,
  report,
}: {
  survey: SurveyTier;
  report: SurveyReport | null;
}) {
  if (survey === "none" || !report) {
    return (
      <p
        className={`mt-3 rounded border ${ATOMS.borderInset} p-2 text-[11px] italic leading-snug ${ATOMS.textDim}`}
      >
        No survey bought. You will not know what this face holds until you are
        standing in it.
      </p>
    );
  }
  const rep = report;

  const f = rep.fuzz;
  const band = (v: number, unit: string) =>
    f
      ? `${Math.round((v * (1 - f)) / 5) * 5}–${Math.round((v * (1 + f)) / 5) * 5}${unit}`
      : `${Math.round(v)}${unit}`;
  const depth =
    rep.depth < 0.3
      ? "close in"
      : rep.depth < 0.55
        ? "spread"
        : rep.depth < 0.8
          ? "mostly far"
          : "all far out";
  const richShare = rep.mass ? rep.rich / rep.mass : 0;
  const verdict: [string, string] =
    rep.mass < 70
      ? ["Thin face", ATOMS.textDanger]
      : rep.mass < 105
        ? ["Workable", ATOMS.textAmber]
        : ["Rich face", ATOMS.textOk];
  const advise =
    (rep.mass < 70
      ? "Claim small. There is not enough here to carry a big commitment."
      : rep.mass < 105
        ? "A middling claim fits. A large one will run the face dry."
        : "Volume enough for a large claim.") +
    (rep.depth > 0.55
      ? " Most of it is a long way out — bring fuel, not hold."
      : rep.depth < 0.3
        ? " It is all close to the mouth. Short trips, cheap fuel."
        : "");

  return (
    <div className={`mt-3 rounded border ${ATOMS.borderInset} p-3`}>
      <div
        className={`font-mono text-xs font-bold uppercase tracking-wider ${verdict[1]}`}
      >
        {verdict[0]}
      </div>
      <div className="mt-2 space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className={ATOMS.textDim}>Pockets</span>
          <b className={ATOMS.textPrimary}>
            {f
              ? `${Math.max(1, rep.pockets - 1)}–${rep.pockets + 1}`
              : rep.pockets}
          </b>
        </div>
        <div className="flex justify-between">
          <span className={ATOMS.textDim}>Total ore</span>
          <b className={ATOMS.textPrimary}>{band(rep.mass, "u")}</b>
        </div>
        <div className="flex justify-between">
          <span className={ATOMS.textDim}>Ore sits</span>
          <b className={ATOMS.textPrimary}>{depth}</b>
        </div>
        <div className="flex justify-between">
          <span className={ATOMS.textDim}>Grade 3+ share</span>
          <b className={ATOMS.textPrimary}>
            {f
              ? richShare < 0.2
                ? "low"
                : richShare < 0.4
                  ? "some"
                  : "high"
              : Math.round(richShare * 100) + "%"}
          </b>
        </div>
        {rep.byGrade && (
          <div className="flex justify-between">
            <span className={ATOMS.textDim}>By grade</span>
            <b className={ATOMS.textPrimary}>
              {rep.byGrade
                .slice(1)
                .map((v, i) => (v ? `g${i + 1}:${v}` : ""))
                .filter(Boolean)
                .join("  ")}
            </b>
          </div>
        )}
      </div>
      <p className={`mt-2 text-[11px] leading-snug ${ATOMS.textDim}`}>
        {advise}
      </p>
    </div>
  );
}
