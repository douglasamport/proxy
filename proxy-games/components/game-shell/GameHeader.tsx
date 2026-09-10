"use client";

import Link from "next/link";
import { ATOMS, SURFACE } from "@/lib/mining-theme";

type GameHeaderProps = {
  section: string;
  /** Defaults to "Extraction" (mining's original hardcoded title) so
   * existing call sites (mining, refine) render unchanged — a game that
   * isn't mining should pass its own, e.g. title="Land Clearing". */
  title?: string;
  /** Small mono readouts, e.g. balance, slot counts. */
  stats?: { label: string; value: string }[];
  links?: { href: string; label: string }[];
  /** Extra controls rendered after the links (e.g. dev-only seed input). */
  children?: React.ReactNode;
};

// One header shell for every game screen (Build, Store, the run page) —
// previously each page hand-rolled its own `.mining-root header` markup.
// Same brand mark, same stat-readout style, same nav-link chrome everywhere.
export function GameHeader({ section, title = "Extraction", stats = [], links = [], children }: GameHeaderProps) {
  return (
    <header className={`flex flex-wrap items-center gap-4 border-b ${ATOMS.borderInset} ${ATOMS.bgRock} px-5 py-3`}>
      <div className={`font-mono text-xs font-bold uppercase tracking-[.14em] ${ATOMS.textPrimary}`}>
        {title} <span className={ATOMS.textTeal}>/ {section}</span>
      </div>

      {stats.map((s) => (
        <div key={s.label} className={`font-mono text-[11px] ${ATOMS.textDim}`}>
          {s.label} <span className={ATOMS.textPrimary}>{s.value}</span>
        </div>
      ))}

      {children}

      <div className="ml-auto flex gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded border ${ATOMS.borderLine} px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.12em] ${ATOMS.textDim} transition ${SURFACE.navLinkHover}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
