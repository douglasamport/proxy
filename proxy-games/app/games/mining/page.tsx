'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './mining.css';
import { CFG, chassisFromEffects } from '@/lib/mining-engine';
import type { Chassis, DirKey, RunStatus, ScoreResult, SurveyReport, SurveyTier } from '@/lib/mining-engine';
import type { PublicRunView } from '@/lib/mining-run-store';
import { FittingPanel } from './FittingPanel';
import { InfoPanel } from './InfoPanel';
import { RunControls, RunField, RunLedger, StatusPanel } from './RunScreen';
import { ResultsModal } from './ResultsModal';
import { SurveyPurchaseModal } from './SurveyPurchaseModal';

type Phase = 'fit' | 'run';

const KEYMAP: Record<string, DirKey> = {
  ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E',
  w: 'N', s: 'S', a: 'W', d: 'E', W: 'N', S: 'S', A: 'W', D: 'E'
};

// Seed control (manual entry + reseed) is dev-only: production players get a
// silently-randomized field and have to make claim/survey decisions based on
// what they're given, not what they can dial in. The server enforces this
// too (see app/api/runs/field/route.ts) — this is a UI convenience, not the
// actual security boundary.
const SHOW_SEED_CONTROLS = process.env.NODE_ENV !== 'production';

interface EndResult {
  status: RunStatus;
  seed: number;
  energyStart: number;
  you: ScoreResult;
  ai: ScoreResult;
}

type CurrentRunPayload =
  | { phase: 'fitting'; runId: string; survey: SurveyTier; report: SurveyReport | null; balance: string }
  | { phase: 'active'; runId: string; view: PublicRunView; balance: string };

async function postJSON<T>(url: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: await res.json() };
}

export default function MiningPage() {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [devSeedInput, setDevSeedInput] = useState('');
  const [chassis, setChassis] = useState<Chassis>(() => chassisFromEffects({}));
  const [equipmentAvailable, setEquipmentAvailable] = useState<string[]>([]);
  const [claim, setClaim] = useState(CFG.ENERGY);
  const [survey, setSurvey] = useState<SurveyTier>('none');
  const [surveyReport, setSurveyReport] = useState<SurveyReport | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [pendingSurveyTier, setPendingSurveyTier] = useState<'basic' | 'full' | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [fitError, setFitError] = useState('');
  const [phase, setPhase] = useState<Phase>('fit');
  const [view, setView] = useState<PublicRunView | null>(null);
  const [lastMsg, setLastMsg] = useState('');
  const [results, setResults] = useState<EndResult | null>(null);
  const busyRef = useRef(false);
  const endingRef = useRef(false);

  // Forces a BRAND NEW field, discarding any unlaunched fit — the explicit
  // "give me a different field" action (dev reseed, Refit, Play again).
  // Plain page load/navigation uses resumeCurrentRun() below instead, which
  // doesn't discard anything.
  const assignField = useCallback(async (seedOverride?: number) => {
    const r = await postJSON<{ runId: string; balance: string }>('/api/runs/field', {
      game: 'mining',
      ...(seedOverride !== undefined ? { seed: seedOverride } : {}),
    });
    if (!r.ok) {
      if (r.status === 401) setAuthRequired(true);
      return;
    }
    setAuthRequired(false);
    setRunId(r.data.runId);
    setBalance(r.data.balance);
    setSurvey('none');
    setSurveyReport(null);
    setFitError('');
    setPhase('fit');
    setView(null);
    setResults(null);
    endingRef.current = false;
  }, []);

  // Resumes whatever's already in progress (an unlaunched fit — survey and
  // all — or a run mid-flight) instead of rolling a new field. This is what
  // mount calls, so navigating to the build/store screens and back doesn't
  // wipe a bought survey or reroll the seed (see app/api/runs/current/route.ts).
  const resumeCurrentRun = useCallback(async () => {
    const r = await postJSON<CurrentRunPayload>('/api/runs/current', { game: 'mining' });
    if (!r.ok) {
      if (r.status === 401) setAuthRequired(true);
      return;
    }
    setAuthRequired(false);
    setRunId(r.data.runId);
    setBalance(r.data.balance);
    setFitError('');
    setResults(null);
    endingRef.current = false;
    if (r.data.phase === 'active') {
      setPhase('run');
      setView(r.data.view);
    } else {
      setPhase('fit');
      setView(null);
      setSurvey(r.data.survey);
      setSurveyReport(r.data.report);
    }
  }, []);

  // For display purposes only — the server recomputes this from scratch at
  // launch (see computeChassis() in lib/mining-inventory.ts) and never
  // trusts this figure. Loadout changes happen on the dedicated build
  // screen; this just reflects them here. Chassis is computed server-side
  // (baseline + equipped effects) rather than re-derived from raw
  // catalog/inventory rows here, so this can't drift from the one place
  // that math actually lives.
  const fetchInventory = useCallback(async () => {
    const res = await fetch('/api/inventory?game=mining');
    if (!res.ok) return;
    const data = await res.json();
    setChassis(data.chassis);
    setBalance(data.balance);
    setEquipmentAvailable(data.equipmentAvailable);
  }, []);

  // Guarded against React Strict Mode's dev-only double-invoke of mount
  // effects: resumeCurrentRun() can itself create a row server-side (when
  // there's nothing to resume), so firing it twice on mount is a real race
  // (two concurrent requests, whichever response resolves last can leave
  // runId pointing at a row the other request's cleanup already deleted).
  // This ref makes the second invocation a no-op regardless of timing.
  const didAssignRef = useRef(false);
  useEffect(() => {
    if (didAssignRef.current) return;
    didAssignRef.current = true;
    resumeCurrentRun();
    fetchInventory();
  }, [resumeCurrentRun, fetchInventory]);

  async function handleLaunch() {
    if (!runId) return;
    // survey and chassis aren't sent — the server applies whatever tier was
    // actually paid for and whatever's actually equipped (see
    // app/api/runs/[id]/launch/route.ts), not anything from here, since a
    // client claim about either can't be trusted for real money.
    const r = await postJSON<PublicRunView>(`/api/runs/${runId}/launch`, { claim });
    if (!r.ok) { setLastMsg('Could not launch — try again.'); return; }
    setView(r.data);
    setPhase('run');
    setLastMsg('');
  }

  function requestSurveyPurchase(tier: 'basic' | 'full') {
    if (tier === survey) return; // already bought, nothing to do
    setPendingSurveyTier(tier);
  }

  async function confirmSurveyPurchase() {
    if (!runId || !pendingSurveyTier) return;
    const tier = pendingSurveyTier;
    setPurchasing(true);
    const r = await postJSON<{ report: SurveyReport; balance: string }>(`/api/runs/${runId}/survey`, { tier });
    setPurchasing(false);
    setPendingSurveyTier(null);
    if (!r.ok) {
      setFitError(r.status === 402 ? 'Not enough balance for that survey.' : 'Could not buy survey — try again.');
      return;
    }
    setFitError('');
    setSurvey(tier);
    setSurveyReport(r.data.report);
    setBalance(r.data.balance);
    router.refresh(); // balance changed — refresh the header's server-rendered figure
  }

  function handleReseed() {
    const parsed = parseInt(devSeedInput, 10);
    assignField(Number.isFinite(parsed) ? parsed : undefined);
  }

  function handleRefit() {
    assignField();
  }

  const runAction = useCallback(async (path: string, body?: unknown) => {
    if (!runId || busyRef.current) return;
    busyRef.current = true;
    const r = await postJSON<{ view: PublicRunView; err?: string }>(`/api/runs/${runId}/${path}`, body);
    busyRef.current = false;
    if (!r.ok) { setLastMsg('Request failed — try again.'); return; }
    setLastMsg(r.data.err || '');
    setView(r.data.view);
  }, [runId]);

  const doMove = useCallback((dir: DirKey) => {
    if (!view || view.status !== 'active') return;
    runAction('move', { direction: dir });
  }, [view, runAction]);

  const doExtract = useCallback(() => { runAction('extract'); }, [runAction]);
  const doPing = useCallback(() => { runAction('ping'); }, [runAction]);

  // Both consume the equipped item on a successful (err-free) use — see
  // the /siphon and /scan-line routes — so the client re-checks what's
  // still available afterward rather than assuming it's still equipped.
  const doSiphon = useCallback(async () => {
    await runAction('siphon');
    fetchInventory();
  }, [runAction, fetchInventory]);

  const doScanLine = useCallback(async () => {
    if (!view?.dir) return;
    await runAction('scan-line', { direction: view.dir });
    fetchInventory();
  }, [view, runAction, fetchInventory]);

  const doEnd = useCallback(async () => {
    if (!runId || endingRef.current) return;
    endingRef.current = true;
    const r = await postJSON<EndResult>(`/api/runs/${runId}/end`);
    if (!r.ok) { endingRef.current = false; setLastMsg('Could not end run — try again.'); return; }
    setResults(r.data);
    router.refresh(); // balance changed — refresh the header's server-rendered figure
  }, [runId, router]);

  // Auto-end: applyMove/applyExtract/applyPing can themselves terminate a
  // run (fuel dry -> stranded, fatal hazard -> wrecked), not just the
  // explicit End Run button. Whenever the view shows a non-active status
  // and we haven't already settled it, close it out the same way.
  useEffect(() => {
    if (view && view.status !== 'active' && !results && !endingRef.current) {
      doEnd();
    }
  }, [view, results, doEnd]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (phase !== 'run' || !view || view.status !== 'active') return;
      const dir = KEYMAP[e.key];
      if (dir) { e.preventDefault(); doMove(dir); }
      else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); doExtract(); }
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); doPing(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [phase, view, doMove, doExtract, doPing]);

  if (authRequired) {
    return (
      <div className="mining-root">
        <header><div className="brand">Extraction <span>/ run prototype</span></div></header>
        <main className="fit-layout">
          <div className="fit-controls sect">
            <div className="lbl">Sign in required</div>
            <p>Live run state now lives server-side against your account, so playing (not just saving) needs you signed in.</p>
            <a className="go" href="/login" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>Sign in</a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="mining-root">
      <header>
        <div className="brand">Extraction <span>/ run prototype</span></div>
        {SHOW_SEED_CONTROLS && (
          <>
            <div className="seedline">
              seed <input
                placeholder="random"
                value={devSeedInput}
                onChange={e => setDevSeedInput(e.target.value)}
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
            {fitError && <div className="ptip" style={{ color: 'var(--danger)' }}>{fitError}</div>}
            <FittingPanel
              chassis={chassis}
              claim={claim}
              survey={survey}
              report={surveyReport}
              balance={balance}
              runId={runId}
              onClaimChange={setClaim}
              onRequestSurvey={requestSurveyPurchase}
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
            {view && <StatusPanel run={view} />}
          </div>

          <div className="col mid">
            <div className="fieldwrap">
              {view && <RunField run={view} onMove={doMove} />}
            </div>
            {view && (
              <RunControls
                run={view}
                lastMsg={lastMsg}
                equipmentAvailable={equipmentAvailable}
                onExtract={doExtract}
                onPing={doPing}
                onEnd={doEnd}
                onSiphon={doSiphon}
                onScanLine={doScanLine}
              />
            )}
          </div>

          <div className="col">
            <div className="lbl">Run ledger</div>
            {view && <RunLedger run={view} />}
          </div>
        </main>
      )}

      {pendingSurveyTier && (
        <SurveyPurchaseModal
          tier={pendingSurveyTier}
          busy={purchasing}
          onConfirm={confirmSurveyPurchase}
          onCancel={() => setPendingSurveyTier(null)}
        />
      )}

      {results && (
        <ResultsModal
          status={results.status}
          seed={results.seed}
          energyStart={results.energyStart}
          you={results.you}
          ai={results.ai}
          onAgain={handleRefit}
        />
      )}
    </div>
  );
}
