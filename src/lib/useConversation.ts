'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTimers } from './hooks';
import { prefersReducedMotion } from './spring';

export type Speaker = 'allya' | 'you' | 'human';

export interface Msg {
  id: number;
  speaker: Speaker;
  text: string;
  /** the small line above the bubble — "Q3 / 6 · Your market", "Your hiring expert" */
  tag?: ReactNode;
  /** filenames shown as a paperclip line inside a sent bubble */
  files?: string[];
}

export interface Chip {
  label: string;
  act: () => void;
}

/* The scripted conversation. Beats chain through `think` (the typing
   dots) exactly like the prototype, but every timer is owned by the
   component, so navigating away mid-script can't fire into a dead tree. */
export function useConversation() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [chips, setChips] = useState<Chip[] | null>(null);
  const { after, clearAll } = useTimers();
  const nextId = useRef(0);

  const say = useCallback((speaker: Speaker, text: string, opts: { tag?: ReactNode; files?: string[] } = {}) => {
    nextId.current += 1;
    setMessages((m) => [...m, { id: nextId.current, speaker, text, ...opts }]);
  }, []);

  /** show the dots for `delay`, then run the next beat */
  const think = useCallback(
    (then: () => void, delay = 900) => {
      setTyping(true);
      after(prefersReducedMotion() ? 200 : delay, () => {
        setTyping(false);
        then();
      });
    },
    [after],
  );

  const showChips = useCallback((list: Chip[]) => setChips(list), []);
  const clearChips = useCallback(() => setChips(null), []);

  const reset = useCallback(() => {
    clearAll();
    setMessages([]);
    setTyping(false);
    setChips(null);
  }, [clearAll]);

  return { messages, typing, chips, say, think, showChips, clearChips, after, reset };
}
