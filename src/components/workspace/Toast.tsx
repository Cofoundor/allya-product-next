'use client';

import { useEffect, useRef } from 'react';
import { Spring, clamp } from '@/lib/spring';

/* The commit cue. It arrives with momentum, holds, then drops away. */
export function Toast({ message, onDone }: { message: { text: string; id: number } | null; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !message) return;

    const inSpring = new Spring(24, {
      response: 0.42,
      damping: 0.8,
      epsilon: 0.05,
      onframe: (y) => {
        el.style.transform = `translate(-50%, ${y}px)`;
        el.style.opacity = String(clamp(1 - y / 24, 0, 1));
      },
    });
    inSpring.to(0, -260);

    let outSpring: Spring | null = null;
    const hold = setTimeout(() => {
      outSpring = new Spring(0, {
        response: 0.4,
        damping: 1,
        epsilon: 0.01,
        onframe: (p, _v, settled) => {
          el.style.opacity = String(1 - p);
          el.style.transform = `translate(-50%, ${p * 12}px)`;
          if (settled) doneRef.current();
        },
      });
      outSpring.to(1);
    }, 2600);

    return () => {
      clearTimeout(hold);
      inSpring.stop();
      outSpring?.stop();
    };
  }, [message]);

  return (
    <div className="shipped" ref={ref}>
      <span className="dot" />
      <span className="txt">{message?.text ?? ''}</span>
    </div>
  );
}
