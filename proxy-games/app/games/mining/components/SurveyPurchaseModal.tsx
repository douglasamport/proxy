"use client";

import { CFG } from "@/lib/mining-engine";
import type { SurveyTier } from "@/lib/mining-engine";
import { Modal } from "@/app/games/mining/components/Modal";
import { ATOMS, SURFACE } from "@/lib/mining-theme";

interface SurveyPurchaseModalProps {
  tier: SurveyTier;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Survey is charged the moment it's bought, not folded into the run's net
// at the end — this is the one confirmation step in the whole fitting flow,
// since it's real money leaving the balance immediately, with no refund if
// the player buys a different tier afterward.
export function SurveyPurchaseModal({
  tier,
  busy,
  onConfirm,
  onCancel,
}: SurveyPurchaseModalProps) {
  const spec = CFG.SURVEY[tier];
  return (
    <Modal>
      <h2
        className={`font-mono text-sm font-bold uppercase tracking-wide ${ATOMS.textPrimary}`}
      >
        Buy {spec.label} survey?
      </h2>
      <p className={`mt-2 text-[12px] leading-relaxed ${ATOMS.textDim}`}>
        This costs <b className={ATOMS.textPrimary}>{spec.cost}</b>, charged
        immediately. Switching to a different tier afterward charges again in
        full.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={onConfirm}
          disabled={busy}
          autoFocus
          className={`flex-1 rounded px-5 py-2 font-mono text-xs font-bold uppercase tracking-[.14em] transition ${SURFACE.btnPrimary} ${SURFACE.btnDisabled}`}
        >
          {busy ? "Buying…" : "Confirm purchase"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className={`rounded border px-4 py-2 font-mono text-xs uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 ${ATOMS.borderLine} ${ATOMS.textDim} ${SURFACE.navLinkHover}`}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
