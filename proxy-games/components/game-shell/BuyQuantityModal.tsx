"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { ATOMS, SURFACE } from "@/lib/mining-theme";

interface BuyQuantityModalProps {
  label: string;
  cost: number;
  maxQuantity: number;
  busy: boolean;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
}

// Quantity picker for buying — mirrors SellQuantityModal, for the same
// reason: one-click only ever buys 1, and picking a real quantity needs
// somewhere to type a number. maxQuantity is already what's affordable
// (funds / cost), or capped at 1 for one-time unlocks — see CatalogScreen —
// so anything typed here is clamped to what's actually buyable. Not used
// for chassis expansion, whose per-unit cost doubles with each one already
// owned rather than staying flat, so "cost × quantity" doesn't apply.
export function BuyQuantityModal({
  label,
  cost,
  maxQuantity,
  busy,
  onConfirm,
  onCancel,
}: BuyQuantityModalProps) {
  const [quantity, setQuantity] = useState(Math.min(1, maxQuantity));

  const clamp = (n: number) =>
    Math.max(1, Math.min(maxQuantity, Math.floor(n) || 1));

  return (
    <Modal>
      <h2
        className={`font-mono text-sm font-bold uppercase tracking-wide ${ATOMS.textPrimary}`}
      >
        Buy {label}
      </h2>
      <p className={`mt-2 text-[12px] leading-relaxed ${ATOMS.textDim}`}>
        {cost.toLocaleString()} cr each · {maxQuantity} affordable
      </p>

      <div className="mt-4 flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={maxQuantity}
          value={quantity}
          onChange={(e) => setQuantity(clamp(Number(e.target.value)))}
          disabled={busy}
          className={`w-24 rounded border ${ATOMS.borderLine} bg-transparent px-3 py-2 font-mono text-sm ${ATOMS.textPrimary}`}
        />
        <span className={`font-mono text-[11px] ${ATOMS.textDim}`}>
          = {(quantity * cost).toLocaleString()} cr
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onConfirm(quantity)}
          disabled={busy}
          autoFocus
          className={`flex-1 rounded px-5 py-2 font-mono text-xs font-bold uppercase tracking-[.14em] transition ${SURFACE.btnPrimary} ${SURFACE.btnDisabled}`}
        >
          {busy ? "Buying…" : "Buy"}
        </button>
        <button
          onClick={() => onConfirm(maxQuantity)}
          disabled={busy}
          className={`rounded border px-4 py-2 font-mono text-xs uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 ${ATOMS.borderLine} ${ATOMS.textDim} ${SURFACE.navLinkHover}`}
        >
          Buy max
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
