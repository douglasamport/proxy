"use client";

import { ATOMS, SURFACE } from "@/lib/mining-theme";

export type StatRow = { label: string; value: string };

// A titled list of label/value readouts — chassis stats (Build), the P&L
// manifest (Results), whatever else needs a "here are some numbers" card.
// One shared shape so those don't each invent their own table styling.
export function StatsPanel({ title, rows }: { title: string; rows: StatRow[] }) {
  return (
    <div className={`rounded-lg ${SURFACE.card} p-4`}>
      <div className={SURFACE.label}>{title}</div>
      <div className={`mt-3 space-y-1.5 border-t ${ATOMS.borderInset} pt-3`}>
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 text-[11px]">
            <span className={ATOMS.textDim}>{r.label}</span>
            <span className={`font-mono font-bold ${ATOMS.textPrimary}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
