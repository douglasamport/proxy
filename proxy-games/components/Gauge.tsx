import { ATOMS, GAME } from "@/lib/mining-theme";

const BAR_COLORS = {
  fuel: GAME.fuel,
  sink: GAME.danger,
  hold: GAME.ok,
  energy: GAME.machine,
} as const;

// A labeled progress bar — fuel/sink/hold/claim on StatusPanel. Colors are
// inline style (GAME.*), not Tailwind classes — an animated width plus a
// dynamic per-tone color isn't something Tailwind's static class scanner
// could resolve anyway, so this is the one legitimate "just use the raw
// value" spot, same as canvas/SVG.
export function Gauge({ tone, label, value, max, suffix = "" }: {
  tone: keyof typeof BAR_COLORS; label: string; value: string | number; max: number; suffix?: string;
}) {
  const pct = Math.max(0, Math.min(100, max ? (Number(value) / max) * 100 : 0));
  return (
    <div className="mb-2.5">
      <div className="mb-0.5 flex justify-between text-[11px]">
        <span className={ATOMS.textDim}>{label}</span>
        <b className={ATOMS.textPrimary}>{value}{suffix}</b>
      </div>
      <div className="h-[5px] overflow-hidden rounded-sm" style={{ background: GAME.panel2 }}>
        <div className="h-full transition-[width]" style={{ width: `${pct}%`, background: BAR_COLORS[tone] }} />
      </div>
    </div>
  );
}
