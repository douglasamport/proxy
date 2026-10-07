"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Chassis } from "@/lib/mining-engine";
import type { ChassisSlot } from "@/lib/proxies";
import { categoryFitsSlot } from "@/lib/slot-categories";

export interface ManagerItem {
  item_key: string;
  label: string;
  category: string;
  description: string | null;
  image_url: string | null;
  effects: Record<string, number>;
}

export interface ManagerChassis {
  id: string;
  name: string;
  assigned: string[];
  slots: ChassisSlot[];
  stats: Chassis;
  scrapValue: number;
}

// Activities a chassis can be assigned to. Only extraction does anything
// today — refining uses its own rig and arena doesn't exist yet.
const ACTIVITIES: { type: string; label: string; available: boolean }[] = [
  { type: "extraction", label: "Extraction (mining)", available: true },
  { type: "refining", label: "Refining", available: false },
  { type: "arena", label: "Arena", available: false },
];

function pretty(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function effectsText(effects: Record<string, number>) {
  return Object.entries(effects)
    .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`)
    .join(" · ");
}

function ItemArt({ item, size }: { item: ManagerItem; size: string }) {
  return item.image_url ? (
    // eslint-disable-next-line @next/next/no-img-element -- catalog art
    <img
      src={item.image_url}
      alt=""
      className={`${size} flex-none rounded object-contain`}
    />
  ) : (
    <div
      className={`${size} flex flex-none items-center justify-center rounded bg-slate-800 text-xs font-bold text-slate-400`}
    >
      {item.label.slice(0, 2).toUpperCase()}
    </div>
  );
}

// Manage every chassis you own. Gear is one shared pool across all of
// them: an item fitted in one chassis isn't spare for another until you
// remove it. Everything here goes through the server
// (POST /api/inventory/equip and POST /api/chassis), which re-checks
// ownership; router.refresh() then re-runs the page's data fetch so the
// numbers always come from the database.
export function ProxyManager({
  chassis,
  items,
  owned,
  mechanicSiteId,
}: {
  chassis: ManagerChassis[];
  items: ManagerItem[];
  owned: Record<string, number>;
  mechanicSiteId: string | null;
}) {
  const router = useRouter();
  const [selectedChassisId, setSelectedChassisId] = useState<string | null>(
    chassis[0]?.id ?? null,
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [confirmScrap, setConfirmScrap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const mechanicHref = mechanicSiteId ? `/site/${mechanicSiteId}` : null;

  if (chassis.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Proxies</h1>
        <p className="text-slate-400">
          You don&apos;t own a chassis.{" "}
          {mechanicHref ? (
            <>
              Buy one at{" "}
              <Link href={mechanicHref} className="underline">
                the Mechanic
              </Link>
              .
            </>
          ) : (
            "Buy one at the Mechanic."
          )}
        </p>
      </div>
    );
  }

  const current =
    chassis.find((c) => c.id === selectedChassisId) ?? chassis[0];
  const byKey = new Map(items.map((i) => [i.item_key, i]));

  // Spare = owned minus fitted in ANY of your chassis (one shared pool).
  const installedCount = new Map<string, number>();
  for (const c of chassis) {
    for (const s of c.slots) {
      if (!s.installed_item_id) continue;
      installedCount.set(
        s.installed_item_id,
        (installedCount.get(s.installed_item_id) ?? 0) + 1,
      );
    }
  }
  const spare = (key: string) =>
    (owned[key] ?? 0) - (installedCount.get(key) ?? 0);

  const standard = current.slots.filter((s) => s.slot_type === "standard");
  const carriage = current.slots.filter((s) => s.slot_type === "carriage");
  const selectedSlot =
    current.slots.find((s) => s.id === selectedSlotId) ?? null;
  const filled = current.slots.filter((s) => s.installed_item_id).length;
  const assignedToExtraction = current.assigned.includes("extraction");
  const extractionHasChassis = chassis.some((c) =>
    c.assigned.includes("extraction"),
  );
  const noFuel = current.stats.fuelCap <= 0;
  const nameValue = nameDraft ?? current.name;

  const candidates = selectedSlot
    ? items
        .filter(
          (i) =>
            categoryFitsSlot(i.category, selectedSlot.slot_type) &&
            spare(i.item_key) > 0 &&
            i.item_key !== selectedSlot.installed_item_id,
        )
        .sort(
          (a, b) =>
            a.category.localeCompare(b.category) ||
            a.label.localeCompare(b.label),
        )
    : [];

  async function post(url: string, payload: unknown, failure: string) {
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.error ? pretty(data.error) + "." : failure);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    router.refresh();
    return data as Record<string, unknown>;
  }

  const setSlot = (slotId: string, itemKey: string | null) =>
    post(
      "/api/inventory/equip",
      { slot_id: slotId, item_key: itemKey },
      "Could not update the chassis — try again.",
    );

  async function rename() {
    const ok = await post(
      "/api/chassis",
      { action: "rename", proxyId: current.id, name: nameValue },
      "Could not rename — try again.",
    );
    if (ok) setNameDraft(null);
  }

  const toggleAssignment = (activityType: string, assigned: boolean) =>
    post(
      "/api/chassis",
      { action: "assign", proxyId: current.id, activityType, assigned },
      "Could not change the assignment — try again.",
    );

  async function scrap() {
    const data = await post(
      "/api/chassis",
      { action: "scrap", proxyId: current.id },
      "Could not scrap — try again.",
    );
    setConfirmScrap(false);
    if (data) {
      setSelectedChassisId(null);
      setSelectedSlotId(null);
      setNotice(
        `Scrapped for ${Number(data.credited).toLocaleString()} credits.`,
      );
    }
  }

  const statRows: [string, string][] = [
    ["Fuel capacity", current.stats.fuelCap.toFixed(0)],
    ["Hold per trip", `${current.stats.hold}u`],
    ["Sink", String(current.stats.sinkCap)],
    ["Speed", current.stats.speed.toFixed(2)],
    ["Movement", current.stats.movement.toFixed(2)],
    ["Ping range", `${current.stats.sensorRange.toFixed(1)} cells`],
    ["Fix accuracy", `±${current.stats.sensorBlur.toFixed(1)}`],
    ["Ping cost", `${current.stats.pingFuel.toFixed(1)} fuel`],
    ["Analyser", current.stats.analyser.toFixed(1)],
    ["Fuel efficiency", current.stats.fuelEfficiency.toFixed(2)],
  ];

  function SlotButton({ slot }: { slot: ChassisSlot }) {
    const item = slot.installed_item_id
      ? byKey.get(slot.installed_item_id)
      : null;
    const active = slot.id === selectedSlotId;
    return (
      <button
        type="button"
        onClick={() => setSelectedSlotId(active ? null : slot.id)}
        className={`flex h-20 flex-col items-center justify-center gap-1 rounded-lg border px-2 text-center text-xs transition ${
          active
            ? "border-cyan-400 bg-slate-800"
            : "border-slate-800 bg-slate-900 hover:border-cyan-600"
        }`}
      >
        {item ? (
          <>
            <ItemArt item={item} size="h-9 w-9" />
            <span className="w-full truncate">{item.label}</span>
          </>
        ) : (
          <span className="text-slate-500">Empty</span>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Proxies</h1>
          <p className="text-sm text-slate-400">
            {chassis.length} chassis · gear is one shared pool across all of
            them
          </p>
        </div>
        <div className="flex gap-4 text-sm text-slate-400">
          {mechanicHref && (
            <Link href={mechanicHref} className="underline">
              Buy / upgrade at the Mechanic
            </Link>
          )}
          <Link href="/inventory" className="underline">
            View all items
          </Link>
        </div>
      </div>

      {notice && <p className="text-sm text-emerald-400">{notice}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!extractionHasChassis && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          No chassis is assigned to Extraction, so you can&apos;t launch a
          mining run. Assign one below.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {chassis.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setSelectedChassisId(c.id);
              setSelectedSlotId(null);
              setNameDraft(null);
              setConfirmScrap(false);
            }}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
              c.id === current.id
                ? "border-cyan-400 bg-slate-800"
                : "border-slate-800 bg-slate-900 hover:border-cyan-600"
            }`}
          >
            <span className="block font-semibold">{c.name}</span>
            <span className="block text-xs text-slate-500">
              {c.assigned.length
                ? c.assigned.map(pretty).join(", ")
                : "Unassigned"}
            </span>
          </button>
        ))}
      </div>

      <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Name</span>
            <input
              value={nameValue}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={24}
              className="rounded border border-slate-700 bg-slate-950 px-3 py-1.5"
            />
          </label>
          <button
            type="button"
            disabled={
              busy || nameValue.trim().length === 0 || nameValue === current.name
            }
            onClick={rename}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-40"
          >
            Rename
          </button>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-widest text-slate-500">
            Assigned to
          </h2>
          <div className="flex flex-wrap gap-4 text-sm">
            {ACTIVITIES.map((a) => (
              <label
                key={a.type}
                className={`flex items-center gap-2 ${a.available ? "" : "text-slate-600"}`}
              >
                <input
                  type="checkbox"
                  disabled={!a.available || busy}
                  checked={current.assigned.includes(a.type)}
                  onChange={(e) => toggleAssignment(a.type, e.target.checked)}
                />
                {a.label}
                {!a.available && (
                  <span className="text-xs">(not available yet)</span>
                )}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Each activity uses one chassis. Assigning it here moves it from
            whichever chassis had it.
          </p>
        </div>
      </section>

      {assignedToExtraction && noFuel && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          This chassis has no fuel tank installed, so a run would strand on
          its first move. Fit a fuel cell below.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-widest text-slate-500">
              Chassis slots · {filled} of {current.slots.length} filled
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {standard.map((s) => (
                <SlotButton key={s.id} slot={s} />
              ))}
            </div>
          </section>

          {carriage.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs uppercase tracking-widest text-slate-500">
                Equipment slots
              </h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {carriage.map((s) => (
                  <SlotButton key={s.id} slot={s} />
                ))}
              </div>
            </section>
          )}

          {selectedSlot && (
            <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {selectedSlot.installed_item_id
                    ? `Replace ${byKey.get(selectedSlot.installed_item_id)?.label ?? selectedSlot.installed_item_id}`
                    : "Fit an item"}
                </h2>
                {selectedSlot.installed_item_id && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setSlot(selectedSlot.id, null)}
                    className="rounded border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              {candidates.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Nothing spare fits this slot. Gear fitted in another chassis
                  has to be removed from it first.{" "}
                  <Link href="/inventory" className="underline">
                    Check inventory
                  </Link>
                  .
                </p>
              ) : (
                <ul className="space-y-2">
                  {candidates.map((i) => (
                    <li key={i.item_key}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setSlot(selectedSlot.id, i.item_key)}
                        className="flex w-full items-center gap-3 rounded border border-slate-800 px-3 py-2 text-left hover:border-cyan-600 disabled:opacity-50"
                      >
                        <ItemArt item={i} size="h-10 w-10" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {i.label}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {pretty(i.category)} · {effectsText(i.effects)}
                          </span>
                        </span>
                        <span className="text-xs text-slate-400">
                          {spare(i.item_key)} spare
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="h-fit space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm">
            <h2 className="mb-2 text-xs uppercase tracking-widest text-slate-500">
              Chassis stats
            </h2>
            <dl className="space-y-1">
              {statRows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="font-mono text-cyan-400">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm">
            <h2 className="mb-2 text-xs uppercase tracking-widest text-slate-500">
              Scrap
            </h2>
            {confirmScrap ? (
              <div className="space-y-2">
                <p className="text-slate-300">
                  Scrap {current.name} for{" "}
                  <b>{current.scrapValue.toLocaleString()}</b> credits? Its
                  slots are destroyed, it&apos;s unassigned from everything, and
                  its gear goes back to your inventory. A replacement costs full
                  price at the Mechanic. This can&apos;t be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={scrap}
                    className="rounded bg-red-700 px-3 py-1.5 font-semibold hover:bg-red-600 disabled:opacity-50"
                  >
                    Scrap it
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmScrap(false)}
                    className="rounded border border-slate-700 px-3 py-1.5 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmScrap(true)}
                className="rounded border border-red-900 px-3 py-1.5 text-red-300 hover:bg-red-950/40 disabled:opacity-50"
              >
                Scrap for {current.scrapValue.toLocaleString()} cr
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
