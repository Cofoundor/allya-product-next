'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BrainCanvas } from '@/components/BrainCanvas';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import { signIn } from '@/lib/api/session';
import { ApiError } from '@/lib/api/client';
import type { Gate } from '@/lib/api/types';
import type { NodeSpec } from '@/lib/brain';

type Status = { kind: 'idle' } | { kind: 'busy'; msg: string } | { kind: 'error'; msg: string };

/* The gate: the company brain drifting full-bleed behind a dark well, with
   the sign-in form sitting in the quiet middle of it. The brain stays
   touchable around the form — the well is only paint.

   Everything it says, and the graph behind it, comes from /gate. The form
   posts to /session: a bad email or password comes back 401 and lands in
   the error state the design was built around. */
export default function LoginGate() {
  const router = useRouter();
  const gate = useResource<Gate>(paths.gate());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const busy = status.kind === 'busy';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!email.trim() || !password) {
      setStatus({ kind: 'error', msg: 'Enter your email and password.' });
      return;
    }

    setStatus({ kind: 'busy', msg: 'Signing you in…' });
    try {
      const session = await signIn(email.trim(), password);
      setStatus({ kind: 'busy', msg: `Welcome back, ${session.user.name.split(' ')[0]}…` });
      router.push('/');
    } catch (err) {
      const e = err as ApiError;
      setStatus({
        kind: 'error',
        msg:
          e?.status === 401
            ? 'That email and password don’t match an account.'
            : e?.offline
              ? 'Can’t reach the server. Try again in a moment.'
              : 'Something went wrong signing you in.',
      });
    }
  }

  return (
    <>
      {/* the gate still stands if the graph can't be fetched — it's the way in */}
      {gate.data ? (
        <BrainCanvas
          boxClassName="login-brain"
          options={{
            nodes: gate.data.brain.nodes as NodeSpec[],
            cross: gate.data.brain.links,
            layout: gate.data.brain.layout,
            revealed: true,
            thoughtEvery: 2.8,
          }}
        />
      ) : null}

      <main className="gate">
        <div className="gate-inner rise-in">
          <div className="mark">
            <span className="lamp" />
            ZeroTo10
            <span className="pill">preview</span>
          </div>

          <h1 className="gate-title">
            {gate.data ? gate.data.headline : 'Welcome back to ZeroTo10.'}
          </h1>
          <p className="gate-lede">
            {gate.data?.lede ??
              'Sign in and Allya picks up where you left off — the work in flight, the decisions waiting on you, the whole company map.'}
          </p>

          <form className="gate-form" onSubmit={onSubmit} noValidate>
            <div className="gate-stack">
              <div className="field">
                <input
                  type="email"
                  name="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-label="Email"
                  value={email}
                  disabled={busy}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  aria-label="Password"
                  value={password}
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button className="gate-submit" type="submit" disabled={busy}>
              Log in
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 12h15M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>

          <div className="gate-note" role="status" aria-live="polite">
            {status.kind === 'busy' && (
              <>
                <span className="spinner" />
                {status.msg}
              </>
            )}
            {status.kind === 'error' && <span className="is-error">{status.msg}</span>}
          </div>

          <p className="gate-foot">
            {gate.data?.footnote ?? 'We’re currently rolling out ZeroTo10.ai to selected users.'}{' '}
            {gate.data ? (
              <a href={gate.data.footnoteLinkHref} target="_blank" rel="noopener noreferrer">
                {gate.data.footnoteLinkLabel}
              </a>
            ) : null}
            .
          </p>
        </div>
      </main>
    </>
  );
}
