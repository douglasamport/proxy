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

// Slot-by-slot view of the mining chassis. Click a slot to pick what goes
// in it; the server (POST /api/inventory/equip) validates ownership and
// slot type. router.refresh() re-runs the page's server fetch, so the stats
// panel and the owned/installed counts always reflect the real database.
export function ProxyManager({
  proxyName,
  slots,
  items,
  owned,
  chassis,
}: {
  proxyName: string;
  slots: ChassisSlot[];
  items: ManagerItem[];
  owned: Record<string, number>;
  chassis: Chassis;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const byKey = new Map(items.map((i) => [i.item_key, i]));
  const installedCount = new Map<string, number>();
  for (const s of slots) {
    if (s.installed_item_id) {
      installedCount.set(
        s.installed_item_id,
        (installedCount.get(s.installed_item_id) ?? 0) + 1,
      );
    }
  }
  const spare = (key: string) =>
    (owned[key] ?? 0) - (installedCount.get(key) ?? 0);

  const standard = slots.filter((s) => s.slot_type === "standard");
  const carriage = slots.filter((s) => s.slot_type === "carriage");
  const selected = slots.find((s) => s.id === selectedId) ?? null;

  const candidates = selected
    ? items
        .filter(
          (i) =>
            categoryFitsSlot(i.category, selected.slot_type) &&
            spare(i.item_key) > 0 &&
            i.item_key !== selected.installed_item_id,
        )
        .sort(
          (a, b) =>
            a.category.localeCompare(b.category) ||
            a.label.localeCompare(b.label),
        )
    : [];

  async function setSlot(slotId: string, itemKey: string | null) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/inventory/equip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot_id: slotId, item_key: itemKey }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(
        res?.status === 400
          ? "Not enough owned, or that item doesn't fit this slot."
          : "Could not update the chassis — try again.",
      );
      return;
    }
    router.refresh();
  }

  const noFuel = chassis.fuelCap <= 0;
  const filled = slots.filter((s) => s.installed_item_id).length;

  const statRows: [string, string][] = [
    ["Fuel capacity", chassis.fuelCap.toFixed(0)],
    ["Hold per trip", `${chassis.hold}u`],
    ["Sink", String(chassis.sinkCap)],
    ["Speed", chassis.speed.toFixed(2)],
    ["Movement", chassis.movement.toFixed(2)],
    ["Ping range", `${chassis.sensorRange.toFixed(1)} cells`],
    ["Fix accuracy", `±${chassis.sensorBlur.toFixed(1)}`],
    ["Ping cost", `${chassis.pingFuel.toFixed(1)} fuel`],
    ["Analyser", chassis.analyser.toFixed(1)],
    ["Fuel efficiency", chassis.fuelEfficiency.toFixed(2)],
  ];

  function SlotButton({ slot }: { slot: ChassisSlot }) {
    const item = slot.installed_item_id
      ? byKey.get(slot.installed_item_id)
      : null;
    const active = slot.id === selectedId;
    return (
      <button
        type="button"
        onClick={() => setSelectedId(active ? null : slot.id)}
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
          <h1 className="text-2xl font-bold">{proxyName}</h1>
          <p className="text-sm text-slate-400">
            Active proxy for extraction · {filled} of {slots.length} slots
            filled
          </p>
        </div>
        <Link href="/inventory" className="text-sm text-slate-400 underline">
          View all items
        </Link>
      </div>

      {noFuel && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          No fuel tank is installed, so a run would strand on its first move.
          Pick an empty slot below and fit a fuel cell.
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-widest text-slate-500">
              Chassis slots
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

          {selected && (
            <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {selected.installed_item_id
                    ? `Replace ${byKey.get(selected.installed_item_id)?.label ?? selected.installed_item_id}`
                    : "Fit an item"}
                </h2>
                {selected.installed_item_id && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setSlot(selected.id, null)}
                    className="rounded border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              {candidates.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Nothing you own fits this slot.{" "}
                  <Link href="/inventory" className="underline">
                    Check inventory
                  </Link>{" "}
                  or visit a store.
                </p>
              ) : (
                <ul className="space-y-2">
                  {candidates.map((i) => (
                    <li key={i.item_key}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setSlot(selected.id, i.item_key)}
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

        <aside className="h-fit rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm">
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
        </aside>
      </div>
    </div>
  );
}
