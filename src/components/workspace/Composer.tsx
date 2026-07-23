'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Spring, clamp } from '@/lib/spring';
import { PressButton } from '@/components/Pressable';
import { ArrowIcon } from '@/components/icons';
import { SUGGESTIONS } from '@/lib/workspace-data';

/* The composer, and the popup that rises out of it on focus. Both springs
   are presentation only — the state flips immediately, so an interrupted
   (or throttled) animation can never strand the UI. */
export function Composer({
  inputRef,
  onSend,
  onEngage,
  onDisengage,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onSend: (text: string) => void;
  onEngage: () => void;
  onDisengage: () => void;
}) {
  const [value, setValue] = useState('');
  const [mounted, setMounted] = useState(false); // suggest is in the DOM
  const wrapRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);
  const fieldPop = useRef<Spring | null>(null);
  const suggestPop = useRef<Spring | null>(null);

  useEffect(() => {
    fieldPop.current = new Spring(0, {
      response: 0.32,
      damping: 0.72,
      onframe: (p, _v, settled) => {
        const el = fieldRef.current;
        if (!el) return;
        el.style.transform = `translateY(${-2.5 * p}px) scale(${1 + 0.012 * p})`;
        if (settled && p === 0) el.style.transform = '';
      },
    });
    suggestPop.current = new Spring(0, {
      response: 0.34,
      damping: 0.78,
      onframe: (p, _v, settled) => {
        const el = suggestRef.current;
        if (el) {
          el.style.opacity = String(clamp(p, 0, 1));
          el.style.transform = `translateY(${9 * (1 - p)}px) scale(${0.96 + 0.04 * Math.min(p, 1.2)})`;
        }
        if (settled && p <= 0.01) setMounted(false);
      },
    });
    return () => {
      fieldPop.current?.stop();
      suggestPop.current?.stop();
    };
  }, []);

  const show = () => {
    if (suggestPop.current?.target === 1) return;
    setMounted(true);
    // pop with a little arrival momentum
    fieldPop.current?.set(0.32, 0.72).to(1, 6);
    suggestPop.current?.set(0.34, 0.78).to(1, 5);
  };

  const hide = () => {
    fieldPop.current?.set(0.3, 1).to(0);
    suggestPop.current?.set(0.3, 1).to(0);
  };

  // pre-paint the start pose so unhiding never flashes at full opacity
  useEffect(() => {
    if (!mounted) return;
    const el = suggestRef.current;
    if (el && suggestPop.current && suggestPop.current.x <= 0.01) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(9px) scale(0.96)';
    }
  }, [mounted]);

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onSend(t);
    setValue('');
    hide();
  };

  return (
    <div
      className="composer"
      ref={wrapRef}
      onBlur={(e) => {
        // moving within the composer isn't leaving it
        if (wrapRef.current?.contains(e.relatedTarget as Node)) return;
        hide();
      }}
    >
      {mounted ? (
        <div className="suggest" ref={suggestRef}>
          <div className="suggest-label">Things I can take off your plate</div>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="suggest-item"
              onMouseDown={(e) => e.preventDefault()} // keep the input focused
              onClick={() => {
                hide();
                onSend(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <div className="field" ref={fieldRef}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Direct Allya — what's eating your week?"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => {
            onEngage();
            show();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') {
              // first Escape closes the popup; a second (with an empty field)
              // steps back to the quiet canvas
              if (mounted && suggestPop.current?.target === 1) hide();
              else if (!value.trim()) onDisengage();
            }
          }}
        />
        <PressButton type="button" className="send" aria-label="Send" pressScale={0.9} onClick={submit}>
          <ArrowIcon />
        </PressButton>
      </div>
    </div>
  );
}
