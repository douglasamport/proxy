"use client";

import { ACCENTS, ACCENT_ALIASES, ATOMS, SURFACE, type Accent } from "@/lib/mining-theme";

type ItemCardProps = {
  label: string;
  description?: string | null;
  effects?: string | null;
  imageSrc: string;
  cost: number;
  funds: number;
  /** Big readout in the status block, e.g. "3" or "—". */
  statusValue: string;
  /** Caption under it, e.g. "slots added" / "unlocked" / "owned". */
  statusCaption: string;
  owned?: boolean;
  busy?: boolean;
  accent?: Accent;
  onBuy: () => void;
};

/** Worn plating: rivet rows, a weld seam, impact scoring, and a peeled corner. */
function PlateOverlay({ tint }: { tint: string }) {
  const rivets = [12, 30, 48, 66, 84];
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* recessed panel inset */}
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        fill="none"
        stroke="#000"
        strokeOpacity=".28"
        strokeWidth="1.2"
      />

      {/* rivet rows down both edges */}
      {rivets.map((y) => (
        <g key={y}>
          <circle cx="4" cy={y} r="1.1" fill="#000" fillOpacity=".35" />
          <circle cx="96" cy={y} r="1.1" fill="#000" fillOpacity=".35" />
        </g>
      ))}

      {/* weld seam across the plate */}
      <path
        d="M0 62 q8 -3 15 0 t15 0 t15 1 t15 -2 t15 1 t25 0"
        fill="none"
        stroke="#000"
        strokeOpacity=".30"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* impact scoring */}
      <path
        d="M18 22 l14 9 M22 34 l9 -6 M70 18 l-11 8"
        stroke="#000"
        strokeOpacity=".22"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* peeled corner, exposing substrate */}
      <path d="M100 0 L100 26 L74 0 Z" fill="#000" fillOpacity=".30" />
      <path
        d="M100 26 L74 0"
        stroke={tint}
        strokeOpacity=".45"
        strokeWidth="1"
      />

      {/* hazard striping along the bottom edge */}
      <path
        d="M0 96 H100"
        stroke="#000"
        strokeOpacity=".38"
        strokeWidth="6"
        strokeDasharray="4 4"
      />
    </svg>
  );
}

export function ItemCard({
  label,
  description,
  effects,
  imageSrc,
  cost,
  funds,
  statusValue,
  statusCaption,
  owned = false,
  busy = false,
  accent = ACCENT_ALIASES.rust,
  onBuy,
}: ItemCardProps) {
  const a = ACCENTS[accent];
  const affordable = cost <= funds;
  const disabled = busy || owned || !affordable;

  return (
    <div className="relative pl-6 pt-6">
      {/* offset accent slab behind the card */}
      <div
        className={`absolute left-0 top-0 h-[calc(100%-1.5rem)] w-[62%] overflow-hidden rounded-lg ${a.panel}`}
        aria-hidden
      >
        <PlateOverlay tint={a.line} />
      </div>

      {/* main card */}
      <div className={`relative flex overflow-hidden rounded-lg ${SURFACE.card} ${SURFACE.cardShadow}`}>
        {/* art */}
        <div className={`relative flex w-[38%] shrink-0 items-center justify-center ${ATOMS.bgRock} p-4`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- catalog art */}
          <img
            src={imageSrc}
            alt=""
            className="max-h-28 w-auto object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,.6)]"
          />
        </div>

        {/* detail */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
          <div className="min-w-0">
            <h3 className={`truncate text-lg font-bold uppercase leading-tight tracking-wide ${ATOMS.textPrimary}`}>
              {label}
            </h3>
            <p className={`mt-0.5 font-mono text-xl font-bold ${a.text}`}>
              {cost.toLocaleString()}
              <span className={`ml-1 text-[10px] font-normal uppercase tracking-[.2em] ${ATOMS.textDim}`}>
                cr
              </span>
            </p>
          </div>

          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              {description && (
                <p className={`line-clamp-2 text-[11px] leading-snug ${ATOMS.textDim}`}>
                  {description}
                </p>
              )}
              {effects && (
                <p className={`font-mono text-[10px] uppercase tracking-wider ${ATOMS.textMuted}`}>
                  {effects}
                </p>
              )}
            </div>

            {/* status readout — replaces the ring gauge */}
            <div className={`shrink-0 border-l ${ATOMS.borderLine} pl-4 text-right`}>
              <div
                className={`font-mono text-2xl font-bold leading-none ${owned ? a.text : ATOMS.textPrimary}`}
              >
                {statusValue}
              </div>
              <div className={`mt-1 whitespace-nowrap ${SURFACE.label}`}>
                {statusCaption}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-1">
            <button
              onClick={onBuy}
              disabled={disabled}
              className={`w-full rounded px-5 py-2 text-[11px] font-bold uppercase tracking-[.14em] ${ATOMS.textVoid} transition ${a.btn} ${SURFACE.btnDisabled}`}
            >
              {owned
                ? "Fitted"
                : busy
                  ? "…"
                  : !affordable
                    ? "Insufficient funds"
                    : "Acquire"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
