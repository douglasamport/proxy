"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ATOMS } from "@/lib/mining-theme";
import { useInventory } from "@/components/game-shell/InventoryContext";

interface ShopChassis {
  id: string;
  name: string;
  standard: number;
  carriage: number;
  filled: number;
  assigned: string[];
  nextSlotCost: number | null;
}

interface Prices {
  chassis: number | null;
  expansion: number | null;
  equipmentBay: number | null;
}

interface ShopEquipment {
  item_key: string;
  label: string;
  description: string | null;
  cost: number;
  sellPrice: number | null;
  owned: number;
  sellable: number;
}

const credits = (n: number) => `${n.toLocaleString()} cr`;

// Everything the Mechanic sells. Each upgrade button acts on exactly one
// chassis (its id goes to POST /api/mechanic); the server re-checks
// ownership and price, so the numbers shown here are display only.
export function MechanicShop({
  siteId,
  balance,
  prices,
  chassis,
  equipment,
}: {
  siteId: string;
  balance: number;
  prices: Prices;
  chassis: ShopChassis[];
  equipment: ShopEquipment[];
}) {
  const router = useRouter();
  const { load } = useInventory();
  const [name, setName] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(key: string, payload: Record<string, unknown>) {
    setBusy(key);
    setError("");
    const res = await fetch("/api/mechanic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, ...payload }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      setError(
        res?.status === 402
          ? "Not enough credits."
          : res?.status === 409
            ? "That can't be done right now."
            : res?.status === 400
              ? "Check the name and try again."
              : "Could not complete that — try again.",
      );
      return false;
    }
    router.refresh();
    await load(); // header balance
    return true;
  }

  async function buyNew() {
    if (await act("new", { action: "buy-chassis", name })) setName("");
  }

  const section = `text-xs uppercase tracking-widest ${ATOMS.textDim}`;
  const card = "rounded-lg border border-slate-800 bg-slate-900 p-4";
  const btn =
    "rounded bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold">The Mechanic</h1>
        <p className="text-sm text-slate-400">
          Chassis, extra slots and equipment bays. Fit gear and assign
          activities on the{" "}
          <Link href="/proxies" className="underline">
            Proxies page
          </Link>
          .
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className={`${card} space-y-3`}>
        <h2 className={section}>New chassis</h2>
        {prices.chassis == null ? (
          <p className="text-sm text-slate-400">Not available right now.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 text-sm">
              <span className="mb-1 block text-slate-400">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                placeholder="e.g. Deep Digger"
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5"
              />
            </label>
            <button
              type="button"
              className={btn}
              disabled={
                busy !== null ||
                name.trim().length === 0 ||
                balance < prices.chassis
              }
              onClick={buyNew}
            >
              {busy === "new" ? "…" : `Buy · ${credits(prices.chassis)}`}
            </button>
          </div>
        )}
        <p className="text-xs text-slate-500">
          A new chassis has 10 standard slots and no gear. Your balance:{" "}
          {credits(balance)}.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={section}>Your chassis</h2>
        {chassis.length === 0 && (
          <p className="text-sm text-slate-400">
            You don&apos;t own a chassis yet — buy one above.
          </p>
        )}
        {chassis.map((c) => (
          <div key={c.id} className={`${card} space-y-3`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold">{c.name}</h3>
              <span className="text-xs text-slate-500">
                {c.assigned.length
                  ? `Assigned: ${c.assigned.join(", ")}`
                  : "Not assigned to anything"}
              </span>
            </div>
            <p className="text-sm text-slate-400">
              {c.standard} standard · {c.carriage} equipment ·{" "}
              {c.filled} filled
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btn}
                disabled={
                  busy !== null ||
                  c.nextSlotCost == null ||
                  balance < c.nextSlotCost
                }
                onClick={() =>
                  act(`${c.id}:expand`, {
                    action: "expand",
                    proxyId: c.id,
                  })
                }
              >
                {busy === `${c.id}:expand`
                  ? "…"
                  : c.nextSlotCost == null
                    ? "Unavailable"
                    : `Add a slot · ${credits(c.nextSlotCost)}`}
              </button>
              {c.carriage >= 1 ? (
                <span className="self-center text-sm text-slate-500">
                  Equipment bay installed
                </span>
              ) : (
                <button
                  type="button"
                  className={btn}
                  disabled={
                    busy !== null ||
                    prices.equipmentBay == null ||
                    balance < prices.equipmentBay
                  }
                  onClick={() =>
                    act(`${c.id}:bay`, {
                      action: "equipment-bay",
                      proxyId: c.id,
                    })
                  }
                >
                  {busy === `${c.id}:bay`
                    ? "…"
                    : prices.equipmentBay == null
                      ? "Unavailable"
                      : `Equipment bay · ${credits(prices.equipmentBay)}`}
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className={section}>Field equipment</h2>
        <p className="text-xs text-slate-500">
          Single-use tools for runs. Fit them in an equipment slot on the
          Proxies page. Fitted copies can&apos;t be sold until you remove them.
        </p>
        {equipment.map((e) => {
          const n = Math.max(1, qty[e.item_key] ?? 1);
          return (
            <div key={e.item_key} className={`${card} space-y-2`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">{e.label}</h3>
                <span className="text-xs text-slate-500">
                  Owned {e.owned} · sellable {e.sellable}
                </span>
              </div>
              {e.description && (
                <p className="text-sm text-slate-400">{e.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={n}
                  onChange={(ev) =>
                    setQty({
                      ...qty,
                      [e.item_key]: Math.max(1, Number(ev.target.value) || 1),
                    })
                  }
                  className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  className={btn}
                  disabled={busy !== null || balance < e.cost * n}
                  onClick={() =>
                    act(`${e.item_key}:buy`, {
                      action: "buy-item",
                      item_key: e.item_key,
                      quantity: n,
                    })
                  }
                >
                  {busy === `${e.item_key}:buy`
                    ? "…"
                    : `Buy · ${credits(e.cost * n)}`}
                </button>
                {e.sellPrice != null && (
                  <button
                    type="button"
                    className="rounded border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-40"
                    disabled={busy !== null || e.sellable < n}
                    onClick={() =>
                      act(`${e.item_key}:sell`, {
                        action: "sell-item",
                        item_key: e.item_key,
                        quantity: n,
                      })
                    }
                  >
                    {busy === `${e.item_key}:sell`
                      ? "…"
                      : `Sell · ${credits(e.sellPrice * n)}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
