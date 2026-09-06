"use client";

import Link from "next/link";
import { ATOMS, SURFACE } from "@/lib/mining-theme";

type GameHeaderProps = {
  section: string;
  /** Small mono readouts, e.g. balance, slot counts. */
  stats?: { label: string; value: string }[];
  links?: { href: string; label: string }[];
  /** Extra controls rendered after the links (e.g. dev-only seed input). */
  children?: React.ReactNode;
};

// One header shell for every mining screen (Build, Store, the run page) —
// previously each page hand-rolled its own `.mining-root header` markup.
// Same brand mark, same stat-readout style, same nav-link chrome everywhere.
export function GameHeader({ section, stats = [], links = [], children }: GameHeaderProps) {
  return (
    <header className={`flex flex-wrap items-center gap-4 border-b ${ATOMS.borderInset} ${ATOMS.bgRock} px-5 py-3`}>
      <div className={`font-mono text-xs font-bold uppercase tracking-[.14em] ${ATOMS.textPrimary}`}>
        Extraction <span className={ATOMS.textTeal}>/ {section}</span>
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
