'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrainCanvas } from '@/components/BrainCanvas';
import { Transcript } from '@/components/Transcript';
import { TickIcon } from '@/components/icons';
import { useConversation, type Chip } from '@/lib/useConversation';
import { useTimers, prefersReducedMotion } from '@/lib/hooks';
import { saveHandoff } from '@/lib/handoff';
import type { BrainHandle } from '@/lib/brain';
import {
  QUESTIONS,
  MINI_SYNTH_STEPS,
  SYNTH_STEPS,
  SYNTH_HOLD,
  derive,
  revenueStage,
  splitGoals,
  type Derived,
  type Question,
} from '@/lib/onboarding-data';
import { IntroScreen } from './IntroScreen';
import { McqScreen } from './McqScreen';
import { ObComposer, type FileMeta, type ObComposerHandle } from './ObComposer';
import { Showcase } from './Showcase';

/* ============================================================
   Onboarding — a conversation that builds a live model of the company
   as you answer, then synthesises "what Allya can do for you" from
   what you said and hands off into the workspace.

   Four phases: intro → ask → synthesis → showcase. The brain is
   mounted once for ask AND synthesis: synthesis is a layout change on
   the same canvas, not a remount, so the graph you built keeps its
   state, its momentum, and its pointer bindings.
   ============================================================ */

type Phase = 'intro' | 'ask' | 'mini-synth' | 'show' | 'mcq' | 'synth';

function ledgerLine(step: Question, answers: Record<string, string>): ReactNode {
  switch (step.key) {
    case 'business':
      return (
        <>
          Mapped your business — <b>5 areas</b> I can run
        </>
      );
    case 'market':
      return (
        <>
          You sell to <b>{answers.market}</b>
        </>
      );
    case 'customer':
      return <>Learned your customer</>;
    case 'revenue':
      return (
        <>
          Placed your stage — <b>{revenueStage(answers.revenue).badge}</b>
        </>
      );
    case 'goals':
      return (
        <>
          Locked <b>{splitGoals(answers.goals).length} goals</b>
        </>
      );
    case 'edge':
      return <>Captured your edge</>;
    default:
      return <>Noted</>;
  }
}

/* Allya reacts to what was actually said — never the same "Got it" six
   times over, which is what makes a scripted flow feel like a form. */
function withFiles(line: string, files: FileMeta[]) {
  if (!files.length) return line;
  return files.length === 1
    ? `${line} And thanks for ${files[0].name} — I'll read it.`
    : `${line} And thanks for those ${files.length} files — I'll read them.`;
}

export default function Onboarding() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('intro');
  const [idx, setIdx] = useState(-1);
  const [mode, setMode] = useState<'text' | 'choice'>('text');
  const [placeholder, setPlaceholder] = useState('Your company name');
  const [accepting, setAccepting] = useState(false);
  const [focusKey, setFocusKey] = useState(0);
  const [brainSub, setBrainSub] = useState('waiting for a name…');
  const [ledger, setLedger] = useState<{ id: number; node: ReactNode }[]>([]);
  const [synthStep, setSynthStep] = useState(0);
  const [finale, setFinale] = useState(false);
  const [marketAnswer, setMarketAnswer] = useState('Both');
  const [derived, setDerived] = useState<Derived | null>(null);

  const convo = useConversation();
  const { say, think, showChips, clearChips } = convo;
  const { after } = useTimers();

  const answers = useRef<Record<string, string>>({});
  const attachments = useRef<Record<string, string[]>>({});
  const company = useRef('');
  const brain = useRef<BrainHandle | null>(null);
  const composer = useRef<ObComposerHandle | null>(null);
  const idxRef = useRef(-1);
  const acceptingRef = useRef(false);
  const ledgerId = useRef(0);
  /** breaks the askStep ↔ submitAnswer cycle */
  const submitRef = useRef<(value: string, files: FileMeta[]) => void>(() => {});

  const setAccept = (v: boolean) => {
    acceptingRef.current = v;
    setAccepting(v);
  };

  /* ---- asking ---- */
  const askStep = useCallback(
    (i: number) => {
      idxRef.current = i;
      setIdx(i);

      if (i === -1) {
        setBrainSub('waiting for a name…');
        say(
          'allya',
          "Hi — I'm Allya, and I'll be running the parts of your company you don't have time for. Before we begin: what's your company called?",
          { tag: 'First things first' },
        );
        setMode('text');
        setPlaceholder('Your company name');
      } else {
        const step = QUESTIONS[i];
        setBrainSub('building as you talk…');
        say('allya', step.q, {
          tag: (
            <>
              <b>Q{i + 1}</b> / 6 · {step.tag}
            </>
          ),
        });
        if (step.type === 'choice') {
          showChips((step.options || []).map((o) => ({ label: o, act: () => submitRef.current(o, []) })));
        } else if (step.example) {
          showChips([{ label: 'Show me an example', act: () => composer.current?.fill(step.example!) }]);
        }
        setMode(step.type === 'choice' ? 'choice' : 'text');
        setPlaceholder(step.placeholder || '');
      }

      setAccept(true);
      setFocusKey((k) => k + 1);
    },
    [say, showChips],
  );

  /* ---- mini-synthesis → showcase ---- */
  const buildShowcase = useCallback(() => {
    const d = derive(answers.current, company.current);
    setDerived(d);
    // snapshot the market answer into state — the MCQ reads it during render,
    // and refs must not be touched there
    setMarketAnswer(answers.current.market || 'Both');
    setPhase('show');
  }, []);

  /* The first beat is a SKETCH: a contained card, gentle, ~1.7s. No rAF
     wrapper — a backgrounded tab throttles it to zero and strands the flow. */
  const runMiniSynth = useCallback(() => {
    setPhase('mini-synth');
    brain.current?.setThoughts(true);
    brain.current?.setZoom(1, true);
    brain.current?.start();
    brain.current?.bloom();

    let i = 0;
    const tick = () => {
      setSynthStep(i);
      if (i > 0) brain.current?.fireThought();
      i += 1;
      if (i < MINI_SYNTH_STEPS.length) after(400, tick);
      else after(500, buildShowcase);
    };
    tick();
  }, [after, buildShowcase]);

  /* ---- MCQ → full synthesis → workspace ----
     The second beat is a CRESCENDO: fullscreen, the graph grows as it wakes,
     beats lengthen, then a lime wash carries you into the workspace. */
  const runFullSynth = useCallback(() => {
    setSynthStep(0);
    setPhase('synth');
    setFinale(false);
    brain.current?.setThoughts(true);
    brain.current?.setZoom(1, true);
    brain.current?.start();
    brain.current?.bloom();

    const last = SYNTH_STEPS.length - 1;
    let i = 0;
    const tick = () => {
      setSynthStep(i);
      if (i > 0) brain.current?.bloom();
      brain.current?.setZoom(i === last ? 1.6 : 1 + (i / last) * 0.22);
      if (i === last) {
        for (let k = 0; k < 3; k += 1) after(k * 130, () => brain.current?.bloom());
        setFinale(true);
      }
      i += 1;
      if (i <= last) after(SYNTH_HOLD[i - 1], tick);
      // hold on the last line while the wash fades up, then land in the workspace
      else after(prefersReducedMotion() ? 200 : SYNTH_HOLD[last], () => router.push('/'));
    };
    tick();
  }, [after, router]);

  const onMcqConfirm = useCallback(
    (mcqAnswers: Record<string, string | string[]>) => {
      const d = derive(answers.current, company.current);
      saveHandoff({
        company: d.companyName,
        base: d.baseSeg,
        category: d.category,
        oneWord: d.oneWord,
        customer: d.customer.text,
        revenueBadge: d.rev.badge,
        goals: d.goalList,
        pitch: d.pitch,
        edge: d.edge,
        answers: answers.current,
        attachments: attachments.current,
        mcqAnswers,
        at: Date.now(),
      });
      runFullSynth();
    },
    [runFullSynth],
  );

  /* ---- answering ---- */
  const afterAnswer = useCallback(
    (val: string, files: FileMeta[]) => {
      const i = idxRef.current;

      // the name step
      if (i === -1) {
        company.current = val;
        answers.current.company = val;
        if (files.length) attachments.current.company = files.map((f) => f.name);
        brain.current?.setHubLabel(val);
        brain.current?.fireThought();
        const hello = withFiles(`Lovely — ${val} it is. Let me start its brain.`, files);
        think(() => {
          say('allya', hello);
          think(() => askStep(0), 760);
        }, 700);
        return;
      }

      const step = QUESTIONS[i];
      answers.current[step.key] = val;
      if (files.length) attachments.current[step.key] = files.map((f) => f.name);

      // grow the brain for this answer, update the live status, log it
      setBrainSub(step.sub);
      brain.current?.grow(step.cluster(val));
      ledgerId.current += 1;
      const entry = { id: ledgerId.current, node: ledgerLine(step, answers.current) };
      setLedger((prev) => [...prev, entry].slice(-4));

      const ack = withFiles(step.ack(val), files);

      if (i >= QUESTIONS.length - 1) {
        think(() => {
          say('allya', ack);
          after(720, runMiniSynth);
        }, 800);
        return;
      }
      think(() => {
        say('allya', ack);
        think(() => askStep(i + 1), 760);
      }, 700);
    },
    [say, think, after, askStep, runMiniSynth],
  );

  const submitAnswer = useCallback(
    (val: string, files: FileMeta[]) => {
      if (!acceptingRef.current) return; // no double-submit mid-thought
      setAccept(false);
      clearChips();
      say('you', val, { files: files.map((f) => f.name) });
      after(240, () => afterAnswer(val, files));
    },
    [clearChips, say, after, afterAnswer],
  );
  useEffect(() => {
    submitRef.current = submitAnswer;
  });

  const beginAsk = useCallback(() => {
    setPhase('ask');
    askStep(-1); // the flow does not wait on the canvas
  }, [askStep]);

  const onChip = useCallback(
    (c: Chip) => {
      clearChips();
      c.act();
    },
    [clearChips],
  );

  // the MCQ shares the ask screen's shell so the brain column keeps the graph
  // the conversation already grew (remounting would start it from scratch)
  const asking = phase === 'ask' || phase === 'mini-synth' || phase === 'synth' || phase === 'mcq';
  const isMcq = phase === 'mcq';
  const brainVisible = phase !== 'intro' && phase !== 'show';
  const progress = ((idx + 1) / (QUESTIONS.length + 1)) * 100;

  return (
    <>
      {/* ambient lamp in the corner, on every screen */}
      <div className="ob-topbrand">
        <span className="lamp" /> Allya <span className="ob-by">by Zeroto10</span>
      </div>
      <Link className="ob-back" href="/">&larr; Workspace</Link>

      {phase === 'intro' ? <IntroScreen onStart={beginAsk} /> : null}

      {asking ? (
        <section
          className={`ob-screen ${isMcq ? 'ob-mcq' : 'ob-ask'}${
            phase === 'mini-synth' || phase === 'synth' ? ' is-synth' : ''
          }${phase === 'mini-synth' ? ' is-sketch' : ''}${finale ? ' is-finale' : ''}`}
        >
          <div className="ob-progress">
            <div className="ob-progress-bar" style={{ width: `${isMcq ? 100 : progress}%` }} />
          </div>

          <div className={isMcq ? 'ob-mcq-grid' : 'ob-ask-grid'}>
            {/* left — the conversation, or the MCQs once the chat is done */}
            {isMcq && derived ? (
              <McqScreen
                marketAnswer={marketAnswer}
                derived={derived}
                brainRef={brain}
                onConfirm={onMcqConfirm}
              />
            ) : (
              <div className="ob-q-col">
                <div className="ob-chat-head">
                  <span className="avatar">A</span>
                  <span className="ob-ask-name">
                    Allya <span className="ob-ask-role">· your cofounder</span>
                  </span>
                </div>

                <Transcript
                  className="ob-thread"
                  messages={convo.messages}
                  typing={convo.typing}
                  chips={convo.chips}
                  onChip={onChip}
                  nearBottomOnly
                />

                {/* keyed per step: a new question gets a genuinely fresh field */}
                <ObComposer
                  key={focusKey}
                  mode={mode}
                  placeholder={placeholder}
                  accepting={accepting}
                  onSubmit={submitAnswer}
                  handleRef={composer}
                />
              </div>
            )}

            {/* right — the brain, building live */}
            <div className="ob-brain-col">
              <BrainCanvas
                boxClassName="ob-brain-box"
                onReady={(h) => {
                  brain.current = h;
                  h.seedHub('Your company'); // self-retries until the box is sized
                }}
                options={{ layout: 'cluster', revealed: false, thoughtEvery: 4.5 }}
              >
                <div className="ob-brain-head">
                  <span className="ob-brain-title">
                    <span className="brain-live" /> The brain
                  </span>
                  <span className="ob-brain-sub">
                    {isMcq ? 'refining with your answers…' : brainSub}
                  </span>
                </div>
                <div className="ob-ledger">
                  {ledger.map((l) => (
                    <div className="ob-ledger-item rise-in" key={l.id}>
                      <span className="lg-tick">
                        <TickIcon />
                      </span>{' '}
                      {l.node}
                    </div>
                  ))}
                </div>
              </BrainCanvas>
            </div>
          </div>
        </section>
      ) : null}

      {phase === 'mini-synth' ? (
        <div className="ob-synth-status ob-mini-synth">
          <span>
            <span className="ob-synth-spark">✦</span>
            {MINI_SYNTH_STEPS[synthStep]}
          </span>
        </div>
      ) : null}

      {phase === 'synth' ? (
        <div className="ob-synth-status">
          <span>
            <span className="ob-synth-spark">✦</span>
            {SYNTH_STEPS[synthStep]}
          </span>
        </div>
      ) : null}

      {phase === 'show' && derived ? <Showcase data={derived} onEnter={() => setPhase('mcq')} /> : null}
    </>
  );
}
