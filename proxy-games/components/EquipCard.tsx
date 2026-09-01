"use client";

import { ACCENTS, ATOMS, SURFACE, type Accent } from "@/lib/mining-theme";
import { PlateStrip } from "@/components/PlateOverlay";

type EquipCardProps = {
  label: string;
  description?: string | null;
  effects?: string | null;
  imageSrc: string;
  ownedQuantity: number;
  equippedQuantity: number;
  /** How many more can be equipped in this item's pool right now. */
  roomLeft: number;
  busy?: boolean;
  accent?: Accent;
  /** Fired with the next equipped count — the parent owns the actual API call. */
  onEquippedChange: (next: number) => void;
};

// The Build screen's card: same worn-plating language as ItemCard/
// InventoryCard, but the readout strip is interactive — one toggle box per
// owned unit, standing in for both "how many do I have" and "which ones
// are fitted" at once. There's no cost here; it's already paid for.
export function EquipCard({
  label,
  description,
  effects,
  imageSrc,
  ownedQuantity,
  equippedQuantity,
  roomLeft,
  busy = false,
  accent = "consumable",
  onEquippedChange,
}: EquipCardProps) {
  const a = ACCENTS[accent];

  return (
    <div className={`relative overflow-hidden rounded-lg ${SURFACE.card} ${SURFACE.cardShadowSm}`}>
      {/* worn accent spine down the left edge */}
      <div className={`absolute inset-y-0 left-0 w-6 ${a.panel}`} aria-hidden>
        <PlateStrip tint={a.line} />
      </div>

      <div className="flex gap-4 py-4 pl-10 pr-4">
        {/* art */}
        <div className={`flex h-16 w-16 flex-none items-center justify-center rounded-md ${SURFACE.well}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- catalog art */}
          <img src={imageSrc} alt="" className="max-h-14 w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,.55)]" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className={`truncate text-sm font-bold uppercase tracking-wide ${ATOMS.textPrimary}`}>{label}</h2>
          {description && <p className={`mt-1 line-clamp-2 text-[11px] leading-snug ${ATOMS.textDim}`}>{description}</p>}
          {effects && <p className={`mt-1 font-mono text-[10px] uppercase tracking-wider ${ATOMS.textMuted}`}>{effects}</p>}

          {/* unit toggle row — one box per owned copy */}
          <div className={`mt-3 flex flex-wrap items-center gap-1.5 border-t ${ATOMS.borderInset} pt-2`}>
            {Array.from({ length: ownedQuantity }, (_, i) => {
              const isEquipped = i < equippedQuantity;
              const disabled = busy || (!isEquipped && roomLeft <= 0);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => onEquippedChange(isEquipped ? equippedQuantity - 1 : equippedQuantity + 1)}
                  title={isEquipped ? "Fitted — click to remove" : "Click to fit"}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border font-mono text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    isEquipped ? `${a.border} ${a.tintBg} ${a.text}` : `${ATOMS.borderLine} ${ATOMS.textDimmer} ${SURFACE.navLinkHover}`
                  }`}
                >
                  {isEquipped ? "✓" : "+"}
                </button>
              );
            })}
            <span className={`ml-auto whitespace-nowrap ${SURFACE.label}`}>
              {equippedQuantity} / {ownedQuantity} fitted
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
