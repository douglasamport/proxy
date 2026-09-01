"use client";

import { InventoryCardProps } from "@/lib/mining-types";

import { ACCENTS, ATOMS, SURFACE } from "@/lib/mining-theme";
import { PlateStrip } from "@/components/PlateOverlay";

export function InventoryCard({
  label,
  category,
  description,
  imageSrc,
  ownedQuantity,
  equippedQuantity,
  isExpansion,
  isEquipmentSlot,
  accent = "consumable",
}: InventoryCardProps) {
  const a = ACCENTS[accent];
  const unlocked = isEquipmentSlot && ownedQuantity >= 1;

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
          <img
            src={imageSrc}
            alt=""
            className="max-h-14 w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,.55)]"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className={`truncate text-sm font-bold uppercase tracking-wide ${ATOMS.textPrimary}`}>
              {label}
            </h2>
            <span className={`shrink-0 whitespace-nowrap font-mono text-[9px] uppercase tracking-[.16em] ${ATOMS.textDimmer}`}>
              {category}
            </span>
          </div>

          {description && (
            <p className={`mt-1 line-clamp-2 text-[11px] leading-snug ${ATOMS.textDim}`}>
              {description}
            </p>
          )}

          {/* readout strip */}
          <div className={`mt-3 flex items-end gap-5 border-t ${ATOMS.borderInset} pt-2`}>
            {isExpansion ? (
              <Stat
                value={String(ownedQuantity)}
                caption="slots added"
                tone={a.text}
              />
            ) : isEquipmentSlot ? (
              <Stat
                value={unlocked ? "✓" : "—"}
                caption={unlocked ? "unlocked" : "locked"}
                tone={unlocked ? a.text : ATOMS.textDimmer}
              />
            ) : (
              <>
                <Stat
                  value={String(ownedQuantity)}
                  caption="owned"
                  tone={ATOMS.textPrimary}
                />
                <Stat
                  value={String(equippedQuantity)}
                  caption="fitted"
                  tone={equippedQuantity > 0 ? a.text : ATOMS.textDimmer}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  value,
  caption,
  tone,
}: {
  value: string;
  caption: string;
  tone: string;
}) {
  return (
    <div>
      <div className={`font-mono text-xl font-bold leading-none ${tone}`}>
        {value}
      </div>
      <div className={`mt-1 whitespace-nowrap ${SURFACE.label}`}>
        {caption}
      </div>
    </div>
  );
}
