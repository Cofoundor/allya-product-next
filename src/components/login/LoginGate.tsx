'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import GateBrain from '@/components/login/GateBrain';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import { signIn } from '@/lib/api/session';
import { ApiError } from '@/lib/api/client';
import type { Gate } from '@/lib/api/types';
import { GATE_COPY, GATE_LINKS, GATE_NODES } from '@/lib/gate-fallback';

type Status = { kind: 'idle' } | { kind: 'busy'; msg: string } | { kind: 'error'; msg: string };

/* The vanilla gate italicises the company name inside the headline; the
   headline arrives as one flat string, so the accent is put back here. */
function accent(text: string) {
  return text.split('ZeroTo10').flatMap((part, i) =>
    i === 0 ? [part] : [<em key={i}>ZeroTo10</em>, part],
  );
}

/* …and it breaks the footnote after the first sentence, which likewise
   arrives as one string. 'ZeroTo10.ai' has no space after its dot, so the
   seam is the first '. ' — the same place the vanilla <br> sits. */
function footLines(text: string): [string, string?] {
  const at = text.indexOf('. ');
  return at === -1 ? [text] : [text.slice(0, at + 1), text.slice(at + 2)];
}

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
  /* the gate is the way in — it stands whole whether or not /gate answers */
  const copy = gate.data ?? GATE_COPY;
  const [footHead, footTail] = footLines(copy.footnote);

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
      {/* the engine reads its graph once at mount, so this waits for the fetch
          to settle and then draws it — from /gate, or from the copy of the
          same graph that ships with the bundle */}
      {gate.loading ? null : (
        <GateBrain
          nodes={gate.data ? gate.data.brain.nodes : GATE_NODES}
          cross={gate.data ? gate.data.brain.links : GATE_LINKS}
        />
      )}

      <main className="gate">
        <div className="gate-inner rise-in">
          <div className="mark">
            <span className="lamp" />
            ZeroTo10
            <span className="pill">preview</span>
          </div>

          <h1 className="gate-title">{accent(copy.headline)}</h1>
          <p className="gate-lede">{copy.lede}</p>

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
            {footHead}
            {footTail === undefined ? ' ' : <br />}
            {footTail}{' '}
            <a href={copy.footnoteLinkHref} target="_blank" rel="noopener noreferrer">
              {copy.footnoteLinkLabel}
            </a>
            .
          </p>
        </div>
      </main>
    </>
  );
}
