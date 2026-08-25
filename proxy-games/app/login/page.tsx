'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';

type Status = 'idle' | 'loading' | 'sent' | 'error';

// Magic-link only, no password field. POST /api/auth/request always returns
// 200 (it can't reveal whether an email has an account), so "error" here
// only ever means a bad request or a network failure — never "wrong email".
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setError('');

    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Something went wrong. Try again.');
        setStatus('error');
        return;
      }

      setStatus('sent');
    } catch {
      setError('Network error. Check your connection and try again.');
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-slate-400">
          We sent a sign-in link to <strong className="text-slate-100">{email}</strong>. Click it to
          continue — it expires in 15 minutes.
        </p>
        <Link href="/" className="text-cyan-400 hover:underline">Back home</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-6 py-24">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-400">No password — we&rsquo;ll email you a link.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-400"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-md bg-cyan-500 px-3 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'loading' ? 'Sending…' : 'Send sign-in link'}
        </button>
      </form>
      {status === 'error' && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
