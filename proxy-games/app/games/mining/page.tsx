'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './mining.css';
import { CFG, applyEnd, applyExtract, applyMove, applyPing, chassisFrom, createRun, applySurvey, score } from './engine';
import type { Alloc, DirKey, RunState, SurveyTier } from './engine';
import { FittingPanel, PRESETS } from './FittingPanel';
import { InfoPanel } from './InfoPanel';
import { RunControls, RunField, RunLedger, StatusPanel } from './RunScreen';
import { ResultsModal } from './ResultsModal';
import type { SaveState } from './ResultsModal';

type Phase = 'fit' | 'run';

const KEYMAP: Record<string, DirKey> = {
  ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E',
  w: 'N', s: 'S', a: 'W', d: 'E', W: 'N', S: 'S', A: 'W', D: 'E'
};

// Seed control (manual entry + reseed) is dev-only: production players get a
// silently-randomized field and have to make claim/survey decisions based on
// what they're given, not what they can dial in.
const SHOW_SEED_CONTROLS = process.env.NODE_ENV !== 'production';

export default function MiningPage() {
  const router = useRouter();
  const [seed, setSeed] = useState(4471);
  const [alloc, setAlloc] = useState<Alloc>({ ...PRESETS[0][1] });
  const [claim, setClaim] = useState(CFG.ENERGY);
  const [survey, setSurvey] = useState<SurveyTier>('none');
  const [phase, setPhase] = useState<Phase>('fit');
  const [run, setRun] = useState<RunState | null>(null);
  const [lastMsg, setLastMsg] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const submittedRunRef = useRef<RunState | null>(null);

  // Randomized client-side, after mount, so the server-rendered HTML and the
  // first client render still match (no hydration mismatch from Math.random).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this is the standard fix for "random value diverges between server and client", not a synchronization smell.
    setSeed(Math.floor(Math.random() * 9000) + 1000);
  }, []);

  function handleLaunch() {
    const chassis = chassisFrom(alloc);
    const next = applySurvey(createRun(seed, chassis, claim), survey);
    setRun(next);
    setPhase('run');
    setLastMsg('');
    setSaveState('idle');
    submittedRunRef.current = null;
  }

  function handleReseed() {
    setSeed(Math.floor(Math.random() * 9000) + 1000);
    setPhase('fit');
  }

  function handleRefit() {
    setPhase('fit');
    setLastMsg('');
  }

  const doMove = useCallback((dir: DirKey) => {
    if (!run || run.status !== 'active') return;
    const r = applyMove(run, dir);
    setLastMsg(r.err || '');
    setRun(r.s);
  }, [run]);
  const doExtract = useCallback(() => {
    if (!run) return;
    const r = applyExtract(run);
    setLastMsg(r.err || '');
    setRun(r.s);
  }, [run]);
  const doPing = useCallback(() => {
    if (!run) return;
    const r = applyPing(run);
    setLastMsg(r.err || '');
    setRun(r.s);
  }, [run]);
  function doEnd() {
    if (!run) return;
    const r = applyEnd(run);
    setLastMsg(r.err || '');
    setRun(r.s);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (phase !== 'run' || !run || run.status !== 'active') return;
      const dir = KEYMAP[e.key];
      if (dir) { e.preventDefault(); doMove(dir); }
      else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); doExtract(); }
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); doPing(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [phase, run, doMove, doExtract, doPing]);

  useEffect(() => {
    if (!run || run.status === 'active') return;
    if (submittedRunRef.current === run) return;
    submittedRunRef.current = run;

    const s = score(run);
    let cancelled = false;
    setSaveState('saving');

    fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game: 'mining',
        seed: run.seed,
        config: { alloc: run.chassis.alloc, claim: run.energyStart, survey: run.survey },
        status: run.status,
        units: s.units,
        grade: s.grade,
        net: s.net,
        moveLog: run.log,
      }),
    })
      .then(res => {
        if (cancelled) return;
        if (res.status === 401) { setSaveState('signed-out'); return; }
        if (!res.ok) { setSaveState('error'); return; }
        setSaveState('saved');
        // The header's balance is a Server Component read once on page load —
        // nothing about ending a run (a purely client-side state change)
        // would otherwise tell it to re-fetch. This refreshes server-rendered
        // parts of the tree (header included) without touching this page's
        // own client state (run, phase, etc. are untouched).
        router.refresh();
      })
      .catch(() => { if (!cancelled) setSaveState('error'); });

    return () => { cancelled = true; };
  }, [run]);

  return (
    <div className="mining-root">
      <header>
        <div className="brand">Extraction <span>/ run prototype</span></div>
        {SHOW_SEED_CONTROLS && (
          <>
            <div className="seedline">
              seed <input
                value={seed}
                onChange={e => setSeed(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <button className="hbtn" onClick={handleReseed}>New field</button>
          </>
        )}
        <button className="hbtn" onClick={handleRefit} disabled={phase === 'fit'}>Refit</button>
      </header>

      {phase === 'fit' ? (
        <main className="fit-layout">
          <div className="fit-controls">
            <FittingPanel
              alloc={alloc}
              claim={claim}
              survey={survey}
              seed={seed}
              onAllocChange={setAlloc}
              onClaimChange={setClaim}
              onSurveyChange={setSurvey}
              onLaunch={handleLaunch}
            />
          </div>
          <div className="fit-info">
            <InfoPanel claim={claim} />
          </div>
        </main>
      ) : (
        <main className="run-layout">
          <div className="col">
            {run && <StatusPanel run={run} />}
          </div>

          <div className="col mid">
            <div className="fieldwrap">
              {run && <RunField run={run} onMove={doMove} />}
            </div>
            {run && (
              <RunControls run={run} lastMsg={lastMsg} onExtract={doExtract} onPing={doPing} onEnd={doEnd} />
            )}
          </div>

          <div className="col">
            <div className="lbl">Run ledger</div>
            {run && <RunLedger run={run} />}
          </div>
        </main>
      )}

      {phase === 'run' && run && run.status !== 'active' && (
        <ResultsModal run={run} onAgain={handleRefit} saveState={saveState} />
      )}
    </div>
  );
}
