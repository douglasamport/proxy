"use client";

import { ATOMS, SURFACE } from "@/lib/mining-theme";

// Full-screen scrim + centered card — SurveyPurchaseModal and ResultsModal
// share this exact chrome, previously two copies of the same `.scrim`/
// `.card` CSS rule.
export function Modal({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${ATOMS.bgScrim} p-4`}>
      <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-sm'} rounded-lg ${SURFACE.card} ${SURFACE.cardShadow} p-6`}>
        {children}
      </div>
    </div>
  );
}
