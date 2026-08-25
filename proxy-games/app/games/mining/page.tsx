'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './mining.css';
import { CFG, applyEnd, applyExtract, applyMove, applyPing, chassisFrom, createRun, applySurvey, score } from './engine';
import type { Alloc, DirKey, RunState, SurveyTier } from './engine';
import { FittingPanel, PRESETS } from './FittingPanel';
import { RunControls, RunField, RunLedger, StatusPanel } from './RunScreen';
import { ResultsModal } from './ResultsModal';
import type { SaveState } from './ResultsModal';

type Phase = 'fit' | 'run';

const KEYMAP: Record<string, DirKey> = {
  ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E',
  w: 'N', s: 'S', a: 'W', d: 'E', W: 'N', S: 'S', A: 'W', D: 'E'
};

export default function MiningPage() {
  const [seed, setSeed] = useState(4471);
  const [alloc, setAlloc] = useState<Alloc>({ ...PRESETS[0][1] });
  const [claim, setClaim] = useState(CFG.ENERGY);
  const [survey, setSurvey] = useState<SurveyTier>('basic');
  const [phase, setPhase] = useState<Phase>('fit');
  const [run, setRun] = useState<RunState | null>(null);
  const [lastMsg, setLastMsg] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const submittedRunRef = useRef<RunState | null>(null);

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
      })
      .catch(() => { if (!cancelled) setSaveState('error'); });

    return () => { cancelled = true; };
  }, [run]);

  return (
    <div className="mining-root">
      <header>
        <div className="brand">Extraction <span>/ run prototype</span></div>
        <div className="seedline">
          seed <input
            value={seed}
            onChange={e => setSeed(parseInt(e.target.value, 10) || 1)}
          />
        </div>
        <button className="hbtn" onClick={handleReseed}>New field</button>
        <button className="hbtn" onClick={handleRefit} disabled={phase === 'fit'}>Refit</button>
      </header>

      <main>
        <div className="col">
          {phase === 'fit' ? (
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
          ) : run ? (
            <StatusPanel run={run} />
          ) : null}
        </div>

        <div className="col mid">
          <div className="fieldwrap">
            {phase === 'run' && run && <RunField run={run} onMove={doMove} />}
          </div>
          {phase === 'run' && run ? (
            <RunControls run={run} lastMsg={lastMsg} onExtract={doExtract} onPing={doPing} onEnd={doEnd} />
          ) : (
            <>
              <div className="controls" />
              <div className="hint">Spend hull volume, claim your energy, then start the day. Same volume, different machine.</div>
            </>
          )}
        </div>

        <div className="col">
          <div className="lbl">Run ledger</div>
          {phase === 'run' && run ? <RunLedger run={run} /> : <div className="ledger" />}
        </div>
      </main>

      {phase === 'run' && run && run.status !== 'active' && (
        <ResultsModal run={run} onAgain={handleRefit} saveState={saveState} />
      )}
    </div>
  );
}
