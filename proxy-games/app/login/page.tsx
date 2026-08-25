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
      <div className="login-page">
        <h1>Check your email</h1>
        <p>
          We sent a sign-in link to <strong>{email}</strong>. Click it to
          continue — it expires in 15 minutes.
        </p>
        <Link href="/">Back home</Link>
      </div>
    );
  }

  return (
    <div className="login-page">
      <h1>Sign in</h1>
      <p>No password — we&rsquo;ll email you a link.</p>
      <form onSubmit={handleSubmit} className="login-form">
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Sending…' : 'Send sign-in link'}
        </button>
      </form>
      {status === 'error' && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
