'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ackAnswer } from './api/resources';
import type { Answers, Question } from './api/types';

/* ============================================================
   The interview, headless.

   The questions, their chips and what Allya says back all come from the
   channel — this only sequences them. A hook rather than a component
   because the page wears the floor's shell: the transcript and composer
   are the floor's, and only the script is ours.

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
  channelId,
  questions,
  onProgress,
  onDone,
}: {
  channelId: string;
  /** null until the channel has answered — the composer waits */
  questions: Question[] | null;
  onProgress: (a: Answers) => void;
  onDone: (a: Answers) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
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
        think(900, () => {
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

      // what she says back is hers, so it's asked for rather than invented
      setTyping(true);
      ackAnswer(channelId, q.key, t)
        .then((r) => r.text)
        .catch(() => '')
        .then((ack) => {
          setTyping(false);
          if (ack) say('allya', ack);
          askQuestion(cur.plan, cur.i + 1, acc);
        });
    },
    [askQuestion, channelId, onProgress, say],
  );

  /** (re)start — from scratch, or already knowing what a thought told us */
  const start = useCallback(
    (from?: { label?: string; acc?: Answers }) => {
      if (!questions) return;
      clearTimers();
      setMessages([]);
      setAsking(null);
      setTyping(false);
      setFinished(false);
      setStarted(true);
      nextId.current = 0;

      const acc: Answers = { ...(from?.acc ?? {}) };
      const plan = questions.filter((q) => !acc[q.key]);
      onProgress(acc);

      if (from?.label) {
        say('allya', `${from.label}. I’ll write that one.`);
        if (acc.point) say('allya', `Taking “${acc.point}” as the line it turns on — say so if that’s wrong.`);
      } else {
        say(
          'allya',
          `Let’s write one. ${questions.length} questions — the answers are the campaign, so short and true beats long and polished.`,
        );
      }
      askQuestion(plan, 0, acc);
    },
    [askQuestion, clearTimers, onProgress, questions, say],
  );

  const chips: InterviewChip[] = asking
    ? asking.options.map((o) => ({ label: o.trim(), kind: asking.chipsAre, text: o }))
    : [];

  return { messages, typing, chips, asking, finished, started, submit, start, ready: !!questions };
}
