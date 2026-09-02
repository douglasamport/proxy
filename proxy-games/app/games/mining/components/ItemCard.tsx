"use client";

import {
  ACCENTS,
  ACCENT_ALIASES,
  ATOMS,
  SURFACE,
  type Accent,
} from "@/lib/mining-theme";
import { PlateOverlay } from "@/app/games/mining/components/PlateOverlay";

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
  /** Disables Acquire regardless of funds/owned, with its own button label
   * (e.g. ore on the Mechanic page — buy it from the Surveyor instead). */
  buyDisabledReason?: string;
  /** Credits for one unit if sold — omit (or 0 available) to hide Sell. */
  sellValue?: number;
  /** How many units are actually sellable (owned minus equipped). */
  sellQuantity?: number;
  sellBusy?: boolean;
  onSell?: () => void;
};

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
  buyDisabledReason,
  sellValue,
  sellQuantity = 0,
  sellBusy = false,
  onSell,
}: ItemCardProps) {
  const a = ACCENTS[accent];
  const affordable = cost <= funds;
  const disabled = busy || owned || !affordable || !!buyDisabledReason;
  const canSell = !!sellValue && sellQuantity > 0 && !!onSell;
  const sellDisabled = sellBusy;

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
      <div
        className={`relative flex overflow-hidden rounded-lg ${SURFACE.card} ${SURFACE.cardShadow}`}
      >
        {/* art */}
        <div
          className={`relative flex w-[38%] shrink-0 items-center justify-center ${ATOMS.bgRock} p-4`}
        >
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
            <h3
              className={`truncate text-lg font-bold uppercase leading-tight tracking-wide ${ATOMS.textPrimary}`}
            >
              {label}
            </h3>
            <p className={`mt-0.5 font-mono text-xl font-bold ${a.text}`}>
              {cost.toLocaleString()}
              <span
                className={`ml-1 text-[10px] font-normal uppercase tracking-[.2em] ${ATOMS.textDim}`}
              >
                cr
              </span>
            </p>
          </div>

          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              {description && (
                <p
                  className={`line-clamp-2 text-[11px] leading-snug ${ATOMS.textDim}`}
                >
                  {description}
                </p>
              )}
              {effects && (
                <p
                  className={`font-mono text-[10px] uppercase tracking-wider ${ATOMS.textMuted}`}
                >
                  {effects}
                </p>
              )}
            </div>

            {/* status readout — replaces the ring gauge */}
            <div
              className={`shrink-0 border-l ${ATOMS.borderLine} pl-4 text-right`}
            >
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

          <div className="mt-auto flex gap-2 pt-1">
            <button
              onClick={onBuy}
              disabled={disabled}
              className={`flex-1 rounded px-5 py-2 text-[11px] font-bold uppercase tracking-[.14em] ${ATOMS.textVoid} transition ${a.btn} ${SURFACE.btnDisabled}`}
            >
              {owned
                ? "Fitted"
                : busy
                  ? "…"
                  : buyDisabledReason
                    ? buyDisabledReason
                    : !affordable
                      ? "Insufficient funds"
                      : "Acquire"}
            </button>
            {canSell && (
              <button
                onClick={onSell}
                disabled={sellDisabled}
                title={`${sellValue!.toLocaleString()} cr each · ${sellQuantity} available`}
                className={`flex-1 rounded border ${ATOMS.borderLine} px-5 py-2 text-[11px] font-bold uppercase tracking-[.14em] ${ATOMS.textDim} transition hover:bg-white/5 ${SURFACE.btnDisabled}`}
              >
                {sellBusy ? "…" : `Sell (${sellValue!.toLocaleString()} cr ea)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
