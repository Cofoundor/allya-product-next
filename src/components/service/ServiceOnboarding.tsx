'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrainCanvas } from '@/components/BrainCanvas';
import { Transcript } from '@/components/Transcript';
import { TickIcon } from '@/components/icons';
import { ObComposer, type ObComposerHandle } from '@/components/onboarding/ObComposer';
import { useConversation } from '@/lib/useConversation';
import { useTimers, prefersReducedMotion } from '@/lib/hooks';
import { splitLeaves } from '@/lib/onboarding-data';
import { GROUPS, branchTints, type BrainHandle } from '@/lib/brain';
import { completeOnboarding, paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import type { ServiceOnboarding as Spec, ObQuestion } from '@/lib/api/types';

/* ============================================================
   A floor's own onboarding — the company onboarding's shape, scoped to one
   service. Four questions in Allya's voice, each growing a cluster on a
   brain that starts as a lone hub, then a settling beat and the way in.

   Everything it asks, says and grows comes from
   GET /surfaces/{id}/onboarding; finishing POSTs the answers, which is what
   unlocks the floor and fills its graph in.
   ============================================================ */

type Phase = 'intro' | 'ask' | 'synth' | 'done';

export default function ServiceOnboarding({ surfaceId }: { surfaceId: string }) {
  const router = useRouter();
  const spec = useResource<Spec>(paths.onboarding(surfaceId));
  // null = whatever the server's status implies; set once the flow moves
  const [phase, setPhase] = useState<Phase | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ledger, setLedger] = useState<{ id: number; text: string }[]>([]);
  const [status, setStatus] = useState('');
  const [synthLine, setSynthLine] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const convo = useConversation();
  const { say, think, showChips, clearChips } = convo;
  const { after } = useTimers();
  const brainRef = useRef<BrainHandle | null>(null);
  const composer = useRef<ObComposerHandle | null>(null);
  const submitRef = useRef<(v: string) => void>(() => {});
  const [accepting, setAccepting] = useState(false);

  const data = spec.data;
  const accent = GROUPS[surfaceId] ?? undefined;
  const questions = data?.questions ?? [];
  const q: ObQuestion | undefined = questions[step];

  /* ---- ask a question: Allya says it, the composer opens ---- */
  const ask = useCallback(
    (i: number, qs: ObQuestion[]) => {
      const s = qs[i];
      if (!s) return;
      setStatus(s.sub);
      think(() => {
        say('allya', s.q, {
          tag: (
            <span className="ob-ask-name">
              {`Q${i + 1} / ${qs.length}`} <span className="ob-ask-role">· {s.tag}</span>
            </span>
          ),
        });
        setAccepting(true);
        if (s.type === 'choice') {
          showChips(s.options.map((o) => ({ label: o, act: () => submitRef.current(o) })));
        } else if (s.example) {
          showChips([{ label: 'Show me an example', act: () => composer.current?.fill(s.example!) }]);
        }
      }, 700);
    },
    [say, think, showChips],
  );

  /* ---- an answer lands: acknowledge it, grow the brain, move on ---- */
  const submit = useCallback(
    (value: string) => {
      const v = value.trim();
      if (!v || !q || !data) return;
      setAccepting(false);
      clearChips();
      say('you', v);
      setAnswers((a) => ({ ...a, [q.key]: v }));

      // the cluster this answer plants
      const c = q.cluster;
      const leaves = c.leavesFrom === 'fixed' ? c.leaves : splitLeaves(v, c.maxLeaves);
      brainRef.current?.grow({ id: c.id, label: c.label, group: c.group, leaves });
      setLedger((l) => [...l, { id: l.length, text: q.learned }]);

      const ack = q.ackByOption[v] ?? q.ack;
      const next = step + 1;
      think(() => {
        if (ack) say('allya', ack);
        if (next < data.questions.length) {
          setStep(next);
          after(520, () => ask(next, data.questions));
        } else {
          after(700, () => setPhase('synth'));
        }
      }, 620);
    },
    [q, data, step, say, think, clearChips, after, ask],
  );

  useEffect(() => {
    submitRef.current = submit;
  });

  /* a floor that's already set up opens on the way in, not the intro —
     derived, so nothing has to be set from an effect */
  const view: Phase = phase ?? (data?.status === 'complete' ? 'done' : 'intro');

  /* finishing is what unlocks the floor and fills its graph in */
  const save = useCallback(() => {
    setError(null);
    completeOnboarding(surfaceId, answers)
      .then(() => setPhase('done'))
      .catch(() => setError("I couldn't save that — the server didn't answer."));
  }, [surfaceId, answers]);

  /* ---- the settling beat, then the way in ---- */
  useEffect(() => {
    if (view !== 'synth' || !data) return;
    brainRef.current?.setThoughts(true);
    brainRef.current?.bloom();
    const hold = prefersReducedMotion() ? 200 : 900;
    data.synth.forEach((_, i) => after(i * hold, () => setSynthLine(i)));
    after(data.synth.length * hold, save);
  }, [view, data, after, save]);

  const start = useCallback(() => {
    if (!data) return;
    setPhase('ask');
    // the hub is seeded by the canvas's own onReady — it doesn't exist yet
    after(320, () => ask(0, data.questions));
  }, [data, after, ask]);


  if (spec.error) {
    return (
      <main className="ob-screen ob-intro">
        <div className="ob-intro-inner">
          <h1 className="ob-title">This floor has no setup of its own.</h1>
          <p className="ob-lede">Either the server is unreachable, or there’s nothing here to fill in.</p>
          <Link className="cta" href={`/${surfaceId}`}>
            Back to {surfaceId}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="ob" style={accent ? ({ ['--accent' as string]: accent } as React.CSSProperties) : undefined}>
      <div className="ob-topbrand">
        <span className="lamp" /> Allya <span className="ob-by">by Zeroto10</span>
      </div>
      <Link className="ob-back" href={`/${surfaceId}`}>
        &larr; {data?.label ?? surfaceId}
      </Link>

      {view === 'intro' && (
        <main className="ob-screen ob-intro">
          <div className="ob-intro-inner">
            <h1 className="ob-title">{data?.title ?? ' '}</h1>
            <p className="ob-lede">{data?.lede ?? ' '}</p>
            <button className="cta" type="button" disabled={!data} onClick={start}>
              {data?.cta ?? 'Start'}
            </button>
          </div>
        </main>
      )}

      {/* ask and synth share ONE canvas — synthesis is a layout change on the
          same graph, not a remount, so what you grew keeps its state */}
      {(view === 'ask' || view === 'synth') && data && (
        <main className={`ob-screen ob-ask${view === 'synth' ? ' is-synth' : ''}`}>
          <div className="ob-progress">
            <div className="ob-progress-bar" style={{ width: `${(step / data.questions.length) * 100}%` }} />
          </div>
          <div className="ob-ask-grid">
            <div className="ob-q-col">
              <div className="ob-chat-head">
                <span className="lamp" />
                <span className="ob-ask-name">
                  Allya <span className="ob-ask-role">· setting up {data.label.toLowerCase()}</span>
                </span>
              </div>
              <Transcript
                className="ob-thread"
                messages={convo.messages}
                typing={convo.typing}
                chips={convo.chips}
                onChip={(c) => {
                  clearChips();
                  c.act();
                }}
              />
              <ObComposer
                mode={q?.type === 'choice' ? 'choice' : 'text'}
                placeholder={q?.placeholder ?? 'Type your answer…'}
                accepting={accepting}
                onSubmit={(v) => submit(v)}
                handleRef={composer}
              />
            </div>

            <div className="ob-brain-col">
              <BrainCanvas
                boxClassName="ob-brain-box"
                onReady={(h) => {
                  brainRef.current = h;
                  // a lone hub to begin with; each answer grows a cluster off it
                  if (!h.nodeCount) h.seedHub(data.label);
                }}
                options={{
                  layout: 'cluster',
                  revealed: false,
                  thoughtEvery: 4.5,
                  accent,
                  groupColors: accent ? branchTints(accent) : undefined,
                }}
              >
                <div className="ob-brain-head">
                  <span className="ob-brain-title">
                    <span className="brain-live" /> {data.label}
                  </span>
                  <span className="ob-brain-sub">{status}</span>
                </div>
                <div className="ob-ledger">
                  {ledger.map((l) => (
                    <div className="ob-ledger-item rise-in" key={l.id}>
                      <span className="lg-tick">
                        <TickIcon size={8} />
                      </span>
                      {l.text}
                    </div>
                  ))}
                </div>
              </BrainCanvas>
            </div>
          </div>
        </main>
      )}

      {view === 'synth' && data && (
        <div className="ob-synth-status">
          <p className="ob-synth-line">
            <span className="ob-synth-spark">✦</span> {error ?? data.synth[synthLine]}
          </p>
          {error ? (
            <button className="cta" type="button" onClick={save}>
              Try again
            </button>
          ) : null}
        </div>
      )}

      {view === 'done' && data && (
        <main className="ob-screen ob-intro">
          <div className="ob-intro-inner">
            <h1 className="ob-title">{data.doneTitle}</h1>
            <p className="ob-lede">{data.doneLede}</p>
            <button className="cta" type="button" onClick={() => router.push(`/${surfaceId}`)}>
              {data.doneCta}
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
