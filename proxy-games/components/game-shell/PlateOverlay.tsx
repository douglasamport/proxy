/** Worn plating: rivet rows, a weld seam, impact scoring, a peeled corner.
 * The shared decorative language for every "physical" card in the game —
 * used behind the accent slab on ItemCard, InventoryCard, and EquipCard.
 * Two sizes: the wide showcase strip (ItemCard) and the narrow spine
 * (InventoryCard, EquipCard). Same visual grammar, different proportions. */

export function PlateOverlay({ tint }: { tint: string }) {
  const rivets = [12, 30, 48, 66, 84];
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* recessed panel inset */}
      <rect x="6" y="6" width="88" height="88" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth="1.2" />

      {/* rivet rows down both edges */}
      {rivets.map((y) => (
        <g key={y}>
          <circle cx="4" cy={y} r="1.1" fill="#000" fillOpacity=".35" />
          <circle cx="96" cy={y} r="1.1" fill="#000" fillOpacity=".35" />
        </g>
      ))}

      {/* weld seam across the plate */}
      <path
        d="M0 62 q8 -3 15 0 t15 0 t15 1 t15 -2 t15 1 t25 0"
        fill="none"
        stroke="#000"
        strokeOpacity=".30"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* impact scoring */}
      <path d="M18 22 l14 9 M22 34 l9 -6 M70 18 l-11 8" stroke="#000" strokeOpacity=".22" strokeWidth="1" strokeLinecap="round" />

      {/* peeled corner, exposing substrate */}
      <path d="M100 0 L100 26 L74 0 Z" fill="#000" fillOpacity=".30" />
      <path d="M100 26 L74 0" stroke={tint} strokeOpacity=".45" strokeWidth="1" />

      {/* hazard striping along the bottom edge */}
      <path d="M0 96 H100" stroke="#000" strokeOpacity=".38" strokeWidth="6" strokeDasharray="4 4" />
    </svg>
  );
}

export function PlateStrip({ tint }: { tint: string }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 30 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect x="3" y="4" width="24" height="92" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth="1" />
      {[14, 38, 62, 86].map((y) => (
        <circle key={y} cx="6" cy={y} r="1.2" fill="#000" fillOpacity=".35" />
      ))}
      <path d="M0 54 q6 -2 12 0 t18 1" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth="2" strokeLinecap="round" />
      <path d="M30 0 L30 14 L18 0 Z" fill="#000" fillOpacity=".28" />
      <path d="M30 14 L18 0" stroke={tint} strokeOpacity=".45" strokeWidth="1" />
      <path d="M0 97 H30" stroke="#000" strokeOpacity=".38" strokeWidth="5" strokeDasharray="3 3" />
    </svg>
  );
}
