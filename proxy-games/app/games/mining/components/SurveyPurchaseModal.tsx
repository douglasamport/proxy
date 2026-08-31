"use client";

import { CFG } from "@/lib/mining-engine";
import type { SurveyTier } from "@/lib/mining-engine";

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
    <div className="scrim">
      <div className="card">
        <h2>Buy {spec.label} survey?</h2>
        <p className="note">
          This costs <b>{spec.cost}</b>, charged immediately. Switching to a
          different tier afterward charges again in full.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            className="go"
            style={{ marginTop: 0, flex: 1 }}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? "Buying…" : "Confirm purchase"}
          </button>
          <button className="cbtn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
