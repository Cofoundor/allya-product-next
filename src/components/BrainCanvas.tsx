'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createBrain, type BrainHandle, type BrainOptions } from '@/lib/brain';

interface Props {
  options: BrainOptions;
  /** handed the live engine once it exists — grow it, fire thoughts at it */
  onReady?: (handle: BrainHandle) => void;
  boxClassName?: string;
  /** absolutely-positioned overlays (the head, the ledger) */
  children?: ReactNode;
}

/* A React shell around the canvas engine. The engine owns the pixels and
   the pointer bindings; React only owns the box around them — which is why
   the graph survives a layout change (ask → synthesis) without losing its
   state or its momentum. */
export function BrainCanvas({ options, onReady, boxClassName, children }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optsRef = useRef(options);
  const readyRef = useRef(onReady);

  // keep the callbacks current without re-creating the engine
  useEffect(() => {
    optsRef.current = options;
    readyRef.current = onReady;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;

    // read the options once, but route the callbacks through the ref so they
    // always see current state (which work needs your eyes, right now)
    const initial = optsRef.current;
    const handle = createBrain(canvas, box, {
      ...initial,
      ...(initial.isLive ? { isLive: (n) => optsRef.current.isLive!(n) } : {}),
      ...(initial.pickTarget ? { pickTarget: (ns) => optsRef.current.pickTarget!(ns) } : {}),
    });

    handle.start();
    readyRef.current?.(handle);
    return () => handle.destroy();
  }, []);

  return (
    <div className={boxClassName} ref={boxRef}>
      <canvas ref={canvasRef} />
      {children}
    </div>
  );
}
