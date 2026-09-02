"use client";

import type { ComponentType } from "react";
import { ACCENTS, ACCENT_ALIASES, ATOMS, SURFACE } from "@/lib/mining-theme";

/**
 * Shared accent palette. ItemCard and InventoryCard each carry their own copy
 * right now — hoist those to import from here so the three components can't
 * drift apart as the palette settles.
 */

export type Accent = keyof typeof ACCENTS;

export type FilterOption<T extends string = string> = {
  value: T;
  label: string;
  Icon?: ComponentType<{ className?: string }>;
  /** Optional right-aligned count, e.g. how many items match. */
  count?: number;
};

type FilterBarProps<T extends string = string> = {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accent?: Accent;
  /** Optional label rendered to the left of the buttons. */
  legend?: string;
  className?: string;
};

export function FilterBar<T extends string = string>({
  options,
  value,
  onChange,
  accent = ACCENT_ALIASES["teal"],
  legend,
  className = "",
}: FilterBarProps<T>) {
  const a = ACCENTS[accent];

  return (
    <div className={`mb-6 flex flex-wrap items-center gap-2 ${className}`}>
      {legend && (
        <span className={`mr-1 font-mono text-[9px] uppercase tracking-[.2em] ${ATOMS.textDimmer}`}>
          {legend}
        </span>
      )}

      {options.map(({ value: v, label, Icon, count }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={[
              "group relative inline-flex items-center gap-1.5 rounded border px-3 py-1.5",
              "font-mono text-[10px] uppercase tracking-[.14em] transition",
              ATOMS.focusRing,
              on ? `${a.border} ${a.tintBg} ${a.text}` : SURFACE.filterInactive,
            ].join(" ")}
          >
            {/* lit indicator, like a panel status lamp */}
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${on ? "" : SURFACE.filterDotInactive}`}
              style={
                on
                  ? { backgroundColor: a.line, boxShadow: `0 0 6px ${a.line}` }
                  : undefined
              }
              aria-hidden
            />
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
            {typeof count === "number" && (
              <span
                className={`ml-0.5 tabular-nums ${on ? "opacity-70" : ATOMS.textDimmer}`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Turns a raw category list into options, with All prepended. */
export function categoryOptions<T extends string>(
  categories: T[],
  allValue: T,
  categoryIcon: (cat: T) => ComponentType<{ className?: string }> | undefined,
  counts?: Record<string, number>,
): FilterOption<T>[] {
  return [
    { value: allValue, label: "All", count: counts?.[allValue] },
    ...categories.map((cat) => ({
      value: cat,
      label: cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " "),
      Icon: categoryIcon(cat),
      count: counts?.[cat],
    })),
  ];
}
