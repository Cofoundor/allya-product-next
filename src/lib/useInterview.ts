'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QUESTIONS, type Answers, type Question } from './email-campaign';
import type { EmailPage } from './api/types';

/* ============================================================
   The interview, headless.

   Five questions, asked one at a time. This is a hook rather than a
   component because the email page wears the same shell as a floor: the
   transcript and the composer are the floor's, and only the script is
   ours.

   Every beat takes the plan, the index and the answers so far as
   arguments rather than reading them back out of state — a chip clicked
   mid-beat can't fire against a stale copy.
   ============================================================ */

export interface Msg {
  id: number;
  speaker: 'allya' | 'you';
  text: string;
  tag?: string;
}

export interface InterviewChip {
  label: string;
  /** 'answer' sends it; 'starter' only opens the sentence in the composer */
  kind: 'answer' | 'starter';
  text: string;
}

export function useInterview({
  page,
  onProgress,
  onDone,
}: {
  page: EmailPage | null;
  onProgress: (a: Answers) => void;
  onDone: (a: Answers) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  /* the question whose chips are showing, not the chips themselves: the
     options quote live numbers, and the first is asked before the API
     has answered */
  const [asking, setAsking] = useState<Question | null>(null);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const timers = useRef<number[]>([]);
  const nextId = useRef(0);
  const pending = useRef<{ plan: Question[]; i: number; acc: Answers } | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const say = useCallback((speaker: 'allya' | 'you', text: string, tag?: string) => {
    nextId.current += 1;
    setMessages((m) => [...m, { id: nextId.current, speaker, text, tag }]);
  }, []);

  const think = useCallback((ms: number, then: () => void) => {
    setTyping(true);
    timers.current.push(
      window.setTimeout(() => {
        setTyping(false);
        then();
      }, ms),
    );
  }, []);

  const askQuestion = useCallback(
    (plan: Question[], i: number, acc: Answers) => {
      if (i >= plan.length) {
        pending.current = null;
        think(1100, () => {
          setFinished(true);
          onDone(acc);
        });
        return;
      }
      const q = plan[i];
      think(700, () => {
        say('allya', q.ask, `${i + 1} / ${plan.length} · ${q.tag}`);
        setAsking(q);
        pending.current = { plan, i, acc };
      });
    },
    [onDone, say, think],
  );

  /** answer whatever is being asked; ignored when she's mid-sentence */
  const submit = useCallback(
    (text: string) => {
      const cur = pending.current;
      const t = text.trim();
      if (!cur || !t) return;
      pending.current = null;
      setAsking(null);

      const q = cur.plan[cur.i];
      const acc = { ...cur.acc, [q.key]: t };
      say('you', t);
      onProgress(acc);
      think(450, () => {
        say('allya', q.ack(t));
        askQuestion(cur.plan, cur.i + 1, acc);
      });
    },
    [askQuestion, onProgress, say, think],
  );

  /** (re)start — from scratch, or already knowing what a thought told us */
  const start = useCallback(
    (from?: { label?: string; acc?: Answers }) => {
      clearTimers();
      setMessages([]);
      setAsking(null);
      setTyping(false);
      setFinished(false);
      setStarted(true);
      nextId.current = 0;

      const acc: Answers = { ...(from?.acc ?? {}) };
      const plan = QUESTIONS.filter((q) => !acc[q.key]);
      onProgress(acc);

      if (from?.label) {
        say('allya', `${from.label}. I’ll write that one.`);
        if (acc.point) say('allya', `Taking “${acc.point}” as the line it turns on — say so if that’s wrong.`);
      } else {
        say(
          'allya',
          'Let’s write one. Five questions — the answers are the campaign, so short and true beats long and polished.',
        );
      }
      askQuestion(plan, 0, acc);
    },
    [askQuestion, clearTimers, onProgress, say],
  );

  const chips: InterviewChip[] = asking
    ? asking.options(page).map((o) => ({ label: o.trim(), kind: asking.chipsAre, text: o }))
    : [];

  return { messages, typing, chips, asking, finished, started, submit, start };
}
