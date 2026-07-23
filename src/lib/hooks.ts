'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Spring, prefersReducedMotion } from './spring';

/* matchMedia is an external store, so subscribe to it rather than mirroring
   it into state — that way there's no extra render after mount, and the
   server snapshot is explicit instead of accidental. */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // SSR: assume no match, then correct on hydration
  );
}

/** Live reduced-motion preference. False during SSR. */
export function useReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** True once mounted in the browser — for gating browser-only capabilities. */
export function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/* Instant press feedback — scale on pointer-down, spring back on release.
   Returns a ref to spread onto the element. */
export function usePressable<T extends HTMLElement>(scale = 0.96) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = new Spring(1, {
      response: 0.28,
      damping: 0.75,
      onframe: (v) => {
        el.style.transform = `scale(${v})`;
      },
    });
    const down = () => s.to(scale);
    const up = () => s.to(1);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
    return () => {
      s.stop();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointerleave', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [scale]);
  return ref;
}

/* setTimeout that cancels every pending timer on unmount, so a scripted
   conversation can never fire into a torn-down tree. */
export function useTimers() {
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const after = useCallback((ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  useEffect(() => clearAll, [clearAll]);
  return { after, clearAll };
}

export { prefersReducedMotion };
