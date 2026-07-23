'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { Chip, Msg } from '@/lib/useConversation';
import { PressButton } from './Pressable';
import { PaperclipIcon } from './icons';
import { useReducedMotion } from '@/lib/hooks';

interface Props {
  messages: Msg[];
  typing: boolean;
  chips: Chip[] | null;
  onChip: (chip: Chip) => void;
  /** onboarding only scrolls when you're already near the bottom, so
      reading back through earlier answers isn't yanked away */
  nearBottomOnly?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Transcript({ messages, typing, chips, onChip, nearBottomOnly, className, children }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (nearBottomOnly && el.scrollHeight - el.scrollTop - el.clientHeight >= 80) return;
    // a timeout, not rAF — a throttled tab must never strand the flow
    const id = setTimeout(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
    }, 0);
    return () => clearTimeout(id);
  }, [messages, typing, chips, nearBottomOnly, reduced]);

  return (
    <div className={className} ref={scroller}>
      {children}
      {messages.map((m, i) => {
        const changed = i > 0 && messages[i - 1].speaker !== m.speaker;
        return (
          <div key={m.id} className={`msg${m.speaker === 'you' ? ' from-you' : ''}${changed ? ' change' : ''}`}>
            <div className="msg-block">
              {m.tag ? <div className="speaker">{m.tag}</div> : null}
              <div className={`bubble ${m.speaker}`}>
                {m.text}
                {m.files?.length ? (
                  <span className="ob-sent-file">
                    <PaperclipIcon size={12} />
                    {m.files.join(', ')}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      {typing ? (
        <div className="msg change">
          <div className="msg-block">
            <div className="bubble allya typing" aria-label="Allya is typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
      ) : null}

      {chips?.length ? (
        <div className="chips">
          {chips.map((c) => (
            <PressButton key={c.label} type="button" className="chip" pressScale={0.94} onClick={() => onChip(c)}>
              {c.label}
            </PressButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}
