"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GAMES } from "@/app/games/registry";

type Proxy = {
  id: string;
  player_id: string;
  name: string;
  slot_count: number;
};

// The chassis hangar: every Proxy a player owns, independent of any game
// (see db/018_proxies.sql), plus which one is currently active per game
// (see db/019_proxy_selection.sql). Building a new one is free; a slot
// expansion or refit cost is a per-chassis purchase from inside that
// game's own store, not from here.
export default function ProxiesPage() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [active, setActive] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/proxies");
    if (!res.ok) {
      if (res.status === 401) setAuthRequired(true);
      setLoading(false);
      return;
    }
    setAuthRequired(false);
    const data = await res.json();
    setProxies(data.proxies);
    setActive(data.active);
    setLoading(false);
  }, []);

  const didLoadRef = useRef(false);
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    load();
  }, [load]);

  async function createProxy() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/proxies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not build that chassis — try again.");
      return;
    }
    setNewName("");
    await load();
  }

  async function selectProxy(game: string, proxyId: string) {
    setError("");
    const res = await fetch("/api/proxies/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, proxy_id: proxyId }),
    });
    if (!res.ok) {
      setError("Could not switch chassis — try again.");
      return;
    }
    await load();
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-6 py-12 text-slate-400">Loading…</div>;
  }

  if (authRequired) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-4 text-2xl font-bold">Sign in required</h1>
        <p className="mb-6 text-slate-400">
          Your chassis hangar is tied to your account.
        </p>
        <Link
          href="/login"
          className="inline-block rounded bg-cyan-600 px-4 py-2 font-semibold text-slate-950"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold">Chassis Hangar</h1>
      <p className="mb-6 text-slate-400">
        Every Proxy you own. Fitting one for a game is done from that game&rsquo;s
        own build/store screen — this is just which chassis is currently in
        the field for each game.
      </p>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      <div className="mb-8 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New chassis name"
          className="flex-1 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
        />
        <button
          onClick={createProxy}
          disabled={busy || !newName.trim()}
          className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          Build chassis
        </button>
      </div>

      {proxies.length === 0 ? (
        <p className="text-slate-400">You don&rsquo;t own a chassis yet.</p>
      ) : (
        <div className="space-y-4">
          {proxies.map((proxy) => (
            <div
              key={proxy.id}
              className="rounded border border-slate-800 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold">{proxy.name}</span>
                <span className="text-sm text-slate-400">
                  {proxy.slot_count} slots
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {GAMES.map((game) => {
                  const isActive = active[game.slug] === proxy.id;
                  return (
                    <button
                      key={game.slug}
                      onClick={() => selectProxy(game.slug, proxy.id)}
                      disabled={isActive}
                      className={
                        isActive
                          ? "rounded border border-cyan-500 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-400"
                          : "rounded border border-slate-800 px-3 py-1.5 text-sm hover:border-cyan-500"
                      }
                    >
                      {isActive ? `Active for ${game.title}` : `Use for ${game.title}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link href="/" className="text-sm text-cyan-400 underline">
          Back home
        </Link>
      </div>
    </div>
  );
}
