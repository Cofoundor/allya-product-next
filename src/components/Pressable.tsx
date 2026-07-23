'use client';

import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { usePressable } from '@/lib/hooks';

/* Instant press feedback — the element scales under the finger and
   springs back on release, interruptibly. */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { pressScale?: number };

export function PressButton({ pressScale = 0.96, ...props }: ButtonProps) {
  const ref = usePressable<HTMLButtonElement>(pressScale);
  return <button ref={ref} {...props} />;
}

type DivProps = HTMLAttributes<HTMLDivElement> & { pressScale?: number };

export function PressDiv({ pressScale = 0.99, ...props }: DivProps) {
  const ref = usePressable<HTMLDivElement>(pressScale);
  return <div ref={ref} {...props} />;
}
