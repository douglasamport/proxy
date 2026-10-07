"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function CharacterCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    if (res?.ok) {
      router.refresh();
      return;
    }
    const data = await res?.json().catch(() => ({}));
    setError(data?.error ?? "Something went wrong");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Character name"
        maxLength={24}
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || name.trim().length < 2}
        className="rounded-md bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
      >
        {busy ? "…" : "Create character"}
      </button>
    </form>
  );
}
