"use client";

import { InventoryCardProps } from "@/lib/mining-types";

import { ACCENTS, ATOMS, SURFACE } from "@/lib/mining-theme";
import { PlateOverlay } from "@/components/game-shell/PlateOverlay";

// Full-width bar layout, matching the Mechanic/Surveyor store's ItemCard
// (see components/game-shell/ItemCard.tsx) so browsing what you own looks
// and behaves like browsing what you can buy — same offset accent slab,
// same art-detail-readout row shape, just without the buy/sell actions.
export function InventoryCard({
  label,
  category,
  description,
  imageSrc,
  ownedQuantity,
  equippedQuantity,
  isExpansion,
  isEquipmentSlot,
  isOre,
  accent = "consumable",
}: InventoryCardProps) {
  const a = ACCENTS[accent];
  const unlocked = isEquipmentSlot && ownedQuantity >= 1;

  return (
    <div className="relative pl-6 pt-6">
      {/* offset accent slab behind the card */}
      <div
        className={`absolute left-0 top-0 h-[calc(100%-1.5rem)] w-40 overflow-hidden rounded-lg ${a.panel}`}
        aria-hidden
      >
        <PlateOverlay tint={a.line} />
      </div>

      {/* main card — single wide row */}
      <div
        className={`relative flex min-h-[8.5rem] w-full items-stretch overflow-hidden rounded-lg ${SURFACE.card} ${SURFACE.cardShadow}`}
      >
        {/* art */}
        <div
          className={`relative flex w-40 shrink-0 items-center justify-center ${ATOMS.bgRock} p-4`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- catalog art */}
          <img
            src={imageSrc}
            alt=""
            className="max-h-24 w-auto max-w-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,.6)]"
          />
        </div>

        {/* name + description */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-5">
          <div className="flex items-start justify-between gap-2">
            <h2
              className={`line-clamp-2 text-lg font-bold uppercase leading-tight tracking-wide ${ATOMS.textPrimary}`}
            >
              {label}
            </h2>
            <span
              className={`shrink-0 whitespace-nowrap font-mono text-[9px] uppercase tracking-[.16em] ${ATOMS.textDimmer}`}
            >
              {category}
            </span>
          </div>
          {description && (
            <p
              className={`line-clamp-2 text-[11px] leading-snug ${ATOMS.textDim}`}
            >
              {description}
            </p>
          )}
        </div>

        {/* readout */}
        {isExpansion ? (
          <Stat
            value={String(ownedQuantity)}
            caption="slots added"
            tone={a.text}
          />
        ) : isOre ? (
          <Stat
            value={String(ownedQuantity)}
            caption="stockpiled"
            tone={ownedQuantity > 0 ? a.text : ATOMS.textDimmer}
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
    <div
      className={`flex w-32 shrink-0 flex-col justify-center border-l ${ATOMS.borderLine} px-5 text-right`}
    >
      <div className={`font-mono text-2xl font-bold leading-none ${tone}`}>
        {value}
      </div>
      <div className={`mt-1 whitespace-nowrap ${SURFACE.label}`}>{caption}</div>
    </div>
  );
}
