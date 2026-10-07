import type { PublicRunView } from '@/lib/mining-run-store';

// Tiny pure helpers over PublicRunView (the redacted, client-safe shape) —
// not the engine's RunState-typed equivalents, since a PublicRunView isn't
// a RunState (no `seen`, cells are PublicCell[] with unknowns zeroed out).
export const atBase = (v: PublicRunView) => v.x === v.base.x && v.y === v.base.y;
export const heldUnits = (v: PublicRunView) => v.carrying.reduce((n, o) => n + o.units, 0);
