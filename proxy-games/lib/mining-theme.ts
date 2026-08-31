/**
 * Single source of truth for colour across proxy-games.
 *
 * Three layers, deliberately separate:
 *   1. PALETTE   — raw hex. The only place a colour literal is written.
 *   2. ACCENTS   — semantic roles ("expansion", "consumable") mapped to Tailwind
 *                  class strings. Components ask for a role, never a colour.
 *   3. GAME      — raw hex for canvas/SVG, where Tailwind classes cannot reach.
 *
 * If you add a colour, add it to PALETTE first and reference it from there.
 * The moment a hex literal appears in a component, this file has failed.
 */

/* ---------------------------------------------------------------- 1. palette */

export const PALETTE = {
  // structure — gunmetal through charcoal
  void: "#0B1116",
  rock: "#0F141A",
  panel: "#141920",
  panelRaised: "#161C24",
  surface: "#1B222B",
  inset: "#232C36",
  line: "#2F3B48",
  lineHover: "#3D4B59",
  disabled: "#2A343E", // inert controls — can't-interact-with-this surfaces

  // type
  text: "#C9D4DE",
  textMuted: "#8FA3B0",
  dim: "#75858F",
  dimmer: "#5A6873",

  // accents — utilitarian, per the style guide, never decorative
  teal: "#54C6DC", // diagnostics, scanners, machine self
  tealDeep: "#2E7A88",
  tealPanel: "#1B4A52",

  amber: "#E0A33E", // warnings, fuel, heat
  amberDeep: "#B8841F",
  amberPanel: "#6E5218",

  rust: "#D9663A", // salvage, wear, ordinary goods
  rustLight: "#E8905F",
  rustDeep: "#C2571F",
  rustPanel: "#7A3B21",

  danger: "#D9564F", // hazard, failure
  gas: "#E86BE0", // gas pockets specifically — worse than ordinary hazard
  ok: "#7BB86F", // banked, safe, complete

  // ore grade ramp — dull through bright, must read as ordered
  grade1: "#7C6C57",
  grade2: "#B98A4A",
  grade3: "#E0A33E",
  grade4: "#F7DE8C",
} as const;

export type PaletteKey = keyof typeof PALETTE;

/* ---------------------------------------------------------------- 2. accents */

/**
 * Semantic roles. A component asks for `accent="expansion"` — it should never
 * know or care that expansion happens to be amber. Re-skinning is editing here.
 */
export const ACCENTS = {
  /** Chassis expansion, capacity, anything that grows the rig. */
  expansion: {
    panel: "bg-[#6E5218]",
    text: "text-[#E0A33E]",
    border: "border-[#E0A33E]",
    tintBg: "bg-[#E0A33E]/10",
    btn: "bg-[#B8841F] hover:bg-[#E0A33E]",
    line: PALETTE.amber,
  },
  /** Equipment bays, sensors, anything diagnostic or machine-side. */
  equipment: {
    panel: "bg-[#1B4A52]",
    text: "text-[#54C6DC]",
    border: "border-[#54C6DC]",
    tintBg: "bg-[#54C6DC]/10",
    btn: "bg-[#2E7A88] hover:bg-[#54C6DC]",
    line: PALETTE.teal,
  },
  /** Ordinary goods, consumables, salvage. The default. */
  consumable: {
    panel: "bg-[#7A3B21]",
    text: "text-[#E8905F]",
    border: "border-[#D9663A]",
    tintBg: "bg-[#D9663A]/10",
    btn: "bg-[#C2571F] hover:bg-[#D9663A]",
    line: PALETTE.rust,
  },
} as const;

export type Accent = keyof typeof ACCENTS;

/** Legacy colour names, so existing `accent="teal"` call sites keep working. */
export const ACCENT_ALIASES = {
  amber: "expansion",
  teal: "equipment",
  rust: "consumable",
} as const satisfies Record<string, Accent>;

/** Maps a catalog category to its accent role. One place to change routing. */
export function accentForCategory(category: string): Accent {
  if (["expansion"].includes(category)) return "expansion";
  if (["equipment_slot", "equipment"].includes(category)) return "equipment";
  return "consumable";
}

/* ------------------------------------------------------------------- 3. game */

/**
 * Raw hex for canvas, SVG stroke/fill, and inline style — anywhere a Tailwind
 * class can't go. These are the same values the mining prototype's CSS
 * variables use; keeping them here is what stops the game and the shell
 * drifting apart visually.
 */
export const GAME = {
  // terrain
  unknown: "#10151B",
  unknownEdge: "#171E26",
  rock: PALETTE.panel,
  panel2: "#222B36", // mining.css's --panel-2 — not a PALETTE role, just used to keep this file and the game's CSS from drifting
  tunnel: "#2B3946",
  tunnelEdge: "#41586B",
  cavern: "#243A3E",
  cavernEdge: "#35585D",
  seam: "#3A3630",
  seamEdge: "#4A453C",

  // ore grades, indexed 1-4 to match tier values
  grade: [
    null,
    PALETTE.grade1,
    PALETTE.grade2,
    PALETTE.grade3,
    PALETTE.grade4,
  ] as const,

  // machine + status
  machine: PALETTE.teal,
  machineDim: PALETTE.tealDeep,
  fuel: PALETTE.amber,
  danger: PALETTE.danger,
  gas: PALETTE.gas,
  ok: PALETTE.ok,
} as const;

/* --------------------------------------------------------------- 4. surfaces */

/**
 * Single-property Tailwind fragments — the atomic building blocks SURFACE
 * and ACCENTS are composed from. Use these instead of writing `text-[${...}]`
 * inline: Tailwind's class scanner reads source files as plain text, it
 * doesn't evaluate template literals, so an interpolated hex never actually
 * generates the CSS rule. The literal has to live in a string constant
 * somewhere — this is that somewhere.
 */
export const ATOMS = {
  textPrimary: "text-[#C9D4DE]", // PALETTE.text
  textMuted: "text-[#8FA3B0]", // PALETTE.textMuted
  textDim: "text-[#75858F]", // PALETTE.dim
  textDimmer: "text-[#5A6873]", // PALETTE.dimmer
  textVoid: "text-[#0B1116]", // PALETTE.void — button labels on a lit accent bg
  bgRock: "bg-[#0F141A]", // PALETTE.rock
  bgDisabled: "bg-[#2A343E]", // PALETTE.disabled
  borderLine: "border-[#2F3B48]", // PALETTE.line
  borderInset: "border-[#232C36]", // PALETTE.inset
  outlineTeal: "outline-[#54C6DC]", // PALETTE.teal — focus rings
  // Complete, variant-prefix-included focus ring — same reasoning as
  // SURFACE.btnDisabled: `focus-visible:${outlineTeal}` would not generate
  // the rule, so the compound has to be written out as one literal.
  focusRing: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#54C6DC]",
} as const;

/** Reused Tailwind fragments, so card chrome stays identical across components. */
export const SURFACE = {
  card: "border border-[#2F3B48] bg-[#141920]",
  cardShadow: "shadow-[0_10px_30px_rgba(0,0,0,.45)]",
  cardShadowSm: "shadow-[0_6px_20px_rgba(0,0,0,.4)]", // denser row-style cards (InventoryCard)
  well: "border border-[#232C36] bg-[#0F141A]",
  divider: "border-[#232C36]",
  label: "font-mono text-[8px] uppercase tracking-[.16em] text-[#75858F]",
  heading: "text-sm font-bold uppercase tracking-wide text-[#C9D4DE]",
  readout: "font-mono font-bold leading-none",
  // FilterBar's inactive/hover chip state — bundled as one token since it's
  // one visual decision (what an "off" filter looks like), not four atoms.
  filterInactive:
    "border-[#2F3B48] bg-[#161C24] text-[#75858F] hover:border-[#3D4B59] hover:text-[#C9D4DE]",
  filterDotInactive: "bg-[#2F3B48] group-hover:bg-[#3D4B59]",
  // Buy-button disabled state. Kept as one complete literal, variant prefix
  // included — Tailwind's scanner matches whole class tokens as they appear
  // in source text, so `disabled:${ATOMS.bgDisabled}` would NOT generate
  // the rule (the scanner never sees that compound string, only the pieces
  // either side of the template expression). Any `disabled:x`/`hover:x`
  // combination has to be written out in full somewhere, not assembled.
  btnDisabled: "disabled:cursor-not-allowed disabled:bg-[#2A343E] disabled:text-[#5A6873]",
} as const;
