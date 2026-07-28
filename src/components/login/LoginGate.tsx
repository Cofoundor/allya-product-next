'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BrainCanvas } from '@/components/BrainCanvas';
import { LOGIN_BRAIN_CROSS, LOGIN_BRAIN_NODES } from '@/lib/login-data';

type Status = { kind: 'idle' } | { kind: 'busy'; msg: string } | { kind: 'error'; msg: string };

/* The gate: the company brain drifting full-bleed behind a dark well, with
   the sign-in form sitting in the quiet middle of it. The brain stays
   touchable around the form — the well is only paint. */
export default function LoginGate() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const busy = status.kind === 'busy';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!email.trim() || !password) {
      setStatus({ kind: 'error', msg: 'Enter your email and password.' });
      return;
    }

    setStatus({ kind: 'busy', msg: 'Signing you in…' });

    /* ---- INTEGRATION POINT ----------------------------------------
       No auth service is wired up yet. Until one is, the gate does what
       a successful sign-in would do: hands you the workspace. Replace
       the body of this timeout with the real call and keep the two
       setStatus branches — the design already accounts for both.
       ---------------------------------------------------------------- */
    timer.current = setTimeout(() => {
      router.push('/');
    }, 900);
  }

  return (
    <>
      <BrainCanvas
        boxClassName="login-brain"
        options={{
          nodes: LOGIN_BRAIN_NODES,
          cross: LOGIN_BRAIN_CROSS,
          layout: 'cluster',
          revealed: true,
          thoughtEvery: 2.8,
        }}
      />

      <main className="gate">
        <div className="gate-inner rise-in">
          <div className="mark">
            <span className="lamp" />
            ZeroTo10
            <span className="pill">preview</span>
          </div>

          <h1 className="gate-title">
            Welcome back to <em>ZeroTo10</em>.
          </h1>
          <p className="gate-lede">
            Sign in and Allya picks up where you left off — the work in flight, the decisions waiting
            on you, the whole company map.
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
            We&rsquo;re currently rolling out ZeroTo10.ai to selected users.
            <br />
            If you&rsquo;d like an account, please apply on{' '}
            <a
              href="https://www.linkedin.com/in/sanshat-bhatia"
              target="_blank"
              rel="noopener noreferrer"
            >
              this link
            </a>
            .
          </p>
        </div>
      </main>
    </>
  );
}
