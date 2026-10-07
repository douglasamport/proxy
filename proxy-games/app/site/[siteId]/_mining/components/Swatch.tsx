import { ATOMS } from "@/lib/mining-theme";

// Small colored terrain/ore swatches — inline style, not a Tailwind class.
// This is the "canvas/SVG, Tailwind can't reach it" case GAME/PALETTE exist
// for: these need to read as the actual field colors, not an approximation.
// Shared by InfoPanel and StatusPanel's field/grade key sections.
export function Swatch({ bg, border, glyph, color }: { bg: string; border?: string; glyph?: string; color?: string }) {
  return (
    <span
      className="mr-2 inline-flex h-[13px] w-[13px] flex-none items-center justify-center rounded-sm text-[8px] font-bold leading-none"
      style={{ background: bg, border: `1px solid ${border ?? bg}`, color }}
    >
      {glyph}
    </span>
  );
}

export function KeyRow({ children }: { children: React.ReactNode }) {
  return <div className={`flex items-center gap-0 py-0.5 text-[11px] ${ATOMS.textDim}`}>{children}</div>;
}
