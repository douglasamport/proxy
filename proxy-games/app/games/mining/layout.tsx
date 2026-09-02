import { useState } from "react";

export default function MiningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authRequired, setAuthRequired] = useState(false);

  return (
    <div className="mining-game-wrapper">
      <MiningHeader authRequired={authRequired}></MiningHeader>

      {children}
    </div>
  );
}

function MiningHeader({ authRequired }) {
  if (authRequired) {
    return (
      <div className={`min-h-screen ${ATOMS.bgVoid}`}>
        <GameHeader section="run" />
        <main className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className={`text-sm ${ATOMS.textDim}`}>
            Live run state now lives server-side against your account, so
            playing (not just saving) needs you signed in.
          </p>
          <a
            href="/login"
            className={`mt-4 inline-block rounded px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider ${ATOMS.textVoid} ${ACCENTS.equipment.btn}`}
          >
            Sign in
          </a>
        </main>
      </div>
    );
  }
}
