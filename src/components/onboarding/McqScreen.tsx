'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PressButton } from '@/components/Pressable';
import { ArrowIcon } from '@/components/icons';
import {
  computePrefill,
  MCQ_BRAIN,
  MCQ_CLUSTER,
  MCQ_QUESTIONS,
  type Derived,
  type McqQuestion,
} from '@/lib/onboarding-data';
import type { BrainHandle } from '@/lib/brain';

interface McqScreenProps {
  marketAnswer: string;
  derived: Derived;
  brainRef: React.RefObject<BrainHandle | null>;
  onConfirm: (answers: Record<string, string | string[]>) => void;
}

function resolveQuestion(q: McqQuestion, marketAnswer: string) {
  if (q.bifurcation) {
    const isB2B = marketAnswer === 'Businesses';
    return {
      question: isB2B ? q.bifurcation.b2bQuestion : q.bifurcation.b2cQuestion,
      answers: isB2B ? q.bifurcation.b2bAnswers : q.bifurcation.b2cAnswers,
    };
  }
  return { question: q.question, answers: q.answers };
}

export function McqScreen({ marketAnswer, derived, brainRef, onConfirm }: McqScreenProps) {
  // open already answered — the founder only corrects what's wrong
  const [selections, setSelections] = useState<Record<string, string | string[]>>(() =>
    computePrefill(derived, marketAnswer),
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // reflect a single-choice answer into the brain (plant / relabel / clear)
  const reflect = useCallback(
    (qid: string, value: string | string[] | undefined) => {
      const bm = MCQ_BRAIN[qid];
      const brain = brainRef.current;
      if (!bm || !brain) return;
      if (value && !Array.isArray(value)) brain.upsertSatellite(bm.cluster, bm.slot, bm.short(value));
      else brain.removeSatellite(bm.slot);
    },
    [brainRef],
  );

  // seed the brain from the prefilled answers once it's mounted here
  useEffect(() => {
    const timers = Object.keys(MCQ_BRAIN).map((qid, i) =>
      window.setTimeout(() => reflect(qid, selections[qid]), 200 + i * 220),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
    // run once on mount — later changes are handled in toggle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(
    (q: McqQuestion, answer: string) => {
      let nextVal: string | string[] | undefined;
      setSelections((prev) => {
        const next = { ...prev };
        if (q.multiSelect) {
          const cur = (prev[q.id] as string[] | undefined) || [];
          next[q.id] = cur.includes(answer) ? cur.filter((a) => a !== answer) : [...cur, answer];
        } else {
          next[q.id] = answer;
        }
        nextVal = next[q.id];
        return next;
      });
      // the brain reacts: mapped single-choices plant/relabel a leaf,
      // everything else sends a thought toward the question's cluster
      if (MCQ_BRAIN[q.id] && !q.multiSelect) reflect(q.id, nextVal);
      else brainRef.current?.pulse(MCQ_CLUSTER[q.id]);
    },
    [brainRef, reflect],
  );

  const isSelected = (qId: string, answer: string) => {
    const val = selections[qId];
    if (Array.isArray(val)) return val.includes(answer);
    return val === answer;
  };

  const handleConfirm = () => {
    onConfirm(selections);
  };

  // renders the LEFT column only — Onboarding owns the grid so the brain
  // column keeps the graph the chat already grew
  return (
    <div className="ob-mcq-col">
      <div className="ob-chat-head">
        <span className="avatar">A</span>
        <span className="ob-ask-name">
          Refine your brain <span className="ob-ask-role">· a few more details</span>
        </span>
      </div>

      <div className="ob-mcq-scroll" ref={scrollRef}>
        <p className="ob-mcq-intro">
          Pick what fits — it sharpens how I think about your business. I&rsquo;ve pre-filled what I
          could from our chat; change anything that&rsquo;s off and watch the brain shift.
        </p>

        <div className="ob-mcq-list">
          {MCQ_QUESTIONS.map((q, i) => {
            const { question, answers } = resolveQuestion(q, marketAnswer);
            return (
              <div className="ob-mcq-q rise-in" key={q.id} style={{ animationDelay: `${40 + i * 30}ms` }}>
                <div className="ob-mcq-label">
                  <span className="ob-mcq-num">{i + 1}</span>
                  <span className="ob-mcq-text">{question}</span>
                  {q.multiSelect && <span className="ob-mcq-multi-hint">Select all that apply</span>}
                </div>
                <div className="ob-mcq-pills">
                  {answers.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={`ob-mcq-pill${isSelected(q.id, a) ? ' selected' : ''}${q.multiSelect ? ' multi' : ''}`}
                      onClick={() => toggle(q, a)}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ob-mcq-foot">
        <PressButton type="button" className="cta ob-mcq-confirm" pressScale={0.97} onClick={handleConfirm}>
          Confirm &amp; build your workspace
          <ArrowIcon size={17} />
        </PressButton>
      </div>
    </div>
  );
}
