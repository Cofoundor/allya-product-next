'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Transcript } from '@/components/Transcript';
import { PressButton } from '@/components/Pressable';
import { ArrowIcon } from '@/components/icons';
import { QUESTIONS, type Answers, type Question } from '@/lib/email-campaign';
import type { EmailPage } from '@/lib/api/types';

/* ============================================================
   The interview.

   Five questions, asked one at a time, each with the answers Allya can
   already guess offered as chips — typing something else always works and
   is usually better. An idea tapped in the brain arrives here as a seed:
   that question is answered before it's asked, and the count adjusts.

   Every beat takes the index and the accumulated answers as arguments
   rather than reading them from state, so a chip clicked mid-beat can't
   fire against a stale copy.
   ============================================================ */

export interface Seed {
  /** why the interview restarted — an idea's name, or "changing one answer" */
  label: string;
  /** what's already known: those questions don't get asked again */
  acc: Answers;
  /** bumped on every start, so the same idea twice still restarts it */
  nonce: number;
}

export function CampaignChat({
  page,
  seed,
  onProgress,
  onDone,
}: {
  page: EmailPage | null;
  seed: Seed | null;
  /** the brief box reads along as the answers land */
  onProgress: (a: Answers) => void;
  onDone: (a: Answers) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  /* the question whose chips are showing, not the chips themselves: the
     options quote live numbers ("Everyone — 412 on the list"), and the
     first question is asked before the API has answered */
  const [asking, setAsking] = useState<Question | null>(null);
  const [value, setValue] = useState('');
  const [finished, setFinished] = useState(false);
  const timers = useRef<number[]>([]);
  const nextId = useRef(0);
  const fieldRef = useRef<HTMLInputElement>(null);
  // what the input is currently answering; null while she's typing
  const pending = useRef<{ plan: Question[]; i: number; acc: Answers } | null>(null);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  const after = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  const say = useCallback((speaker: 'allya' | 'you', text: string, tag?: string) => {
    nextId.current += 1;
    setMessages((m) => [...m, { id: nextId.current, speaker, text, tag }]);
  }, []);

  const think = useCallback(
    (ms: number, then: () => void) => {
      setTyping(true);
      after(ms, () => {
        setTyping(false);
        then();
      });
    },
    [after],
  );

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

  const submit = useCallback(
    (text: string) => {
      const cur = pending.current;
      const t = text.trim();
      if (!cur || !t) return;
      pending.current = null;
      setAsking(null);
      setValue('');

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

  /** (re)start the interview — from scratch, or from an idea in the brain */
  const start = useCallback(
    (from: Seed | null) => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setMessages([]);
      setAsking(null);
      setTyping(false);
      setFinished(false);
      setValue('');
      nextId.current = 0;

      const acc: Answers = { ...(from?.acc ?? {}) };
      // whatever is already known doesn't get asked again, and the count says so
      const plan = QUESTIONS.filter((q) => !acc[q.key]);
      onProgress(acc);

      if (from) {
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
    [askQuestion, onProgress, say],
  );

  // first run, and again whenever an idea is tapped in the brain
  const nonce = seed?.nonce ?? 0;
  const started = useRef(-1);
  useEffect(() => {
    if (started.current === nonce) return;
    started.current = nonce;
    start(nonce ? seed : null);
    // `start` is stable enough for this: it only closes over setters and
    // callbacks the parent memoises
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return (
    <section className="c-sec es-chat">
      <div className="es-box-head">
        <h2>Write a campaign</h2>
        <span>{finished ? 'done — it’s below' : 'five questions'}</span>
      </div>

      <Transcript
        className="es-thread"
        messages={messages}
        typing={typing}
        chips={
          asking
            ? asking.options(page).map((c) => ({
                label: c.trim(),
                // a starter opens the sentence and hands the founder the pen;
                // only they can put a claim in a campaign
                act: () =>
                  asking.chipsAre === 'starter' ? (setValue(c), fieldRef.current?.focus()) : submit(c),
              }))
            : null
        }
        onChip={(c) => c.act()}
        nearBottomOnly
      />

      {finished ? (
        <div className="es-chat-done">
          <button type="button" className="es-restart" onClick={() => start(null)}>
            Write another one
          </button>
        </div>
      ) : (
        <div className="es-field">
          <input
            ref={fieldRef}
            type="text"
            value={value}
            placeholder="Answer in your own words…"
            autoComplete="off"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit(value);
            }}
          />
          <PressButton type="button" className="send" aria-label="Send" pressScale={0.9} onClick={() => submit(value)}>
            <ArrowIcon />
          </PressButton>
        </div>
      )}
    </section>
  );
}

interface Msg {
  id: number;
  speaker: 'allya' | 'you';
  text: string;
  tag?: string;
}
