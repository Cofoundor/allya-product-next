'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Spring, clamp, project, rubberband } from '@/lib/spring';
import { useMediaQuery } from '@/lib/hooks';

/* ============================================================
   Approval surface — axis-aware: a right-hand peek panel on desktop,
   a bottom sheet on mobile, from the same gesture code. Dragging is
   1:1 with velocity handoff, momentum projection, and rubber-banding
   past the open edge.
   ============================================================ */

interface Props {
  /** the work item under review, or null to close */
  context: string | null;
  onClose: () => void;
  onApprove: (context: string) => void;
  onEdit: (context: string) => void;
  /** the gesture and the chrome are the same everywhere; what's inside comes
      from whatever the server says about the item under review */
  renderHead: (context: string) => ReactNode;
  renderBody: (context: string) => ReactNode;
  approveLabel: (context: string) => string;
}

export function ApprovalSheet({
  context,
  onClose,
  onApprove,
  onEdit,
  renderHead,
  renderBody,
  approveLabel,
}: Props) {
  // what's rendered — kept alive through the close animation. `gen` bumps on
  // every open so re-opening the same item still replays the entrance.
  const [render, setRender] = useState<{ ctx: string; gen: number } | null>(null);
  const genRef = useRef(0);

  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const springRef = useRef<Spring | null>(null);
  const closedPos = useRef(0);
  const sheetDim = useRef(0);
  const openState = useRef<false | true | 'closing'>(false);

  const isDesktop = useMediaQuery('(min-width: 900px)');
  const desktopRef = useRef(isDesktop);
  useEffect(() => {
    desktopRef.current = isDesktop;
  });
  const axis = useCallback(() => (desktopRef.current ? 'x' : 'y'), []);

  const measure = useCallback(() => {
    const el = sheetRef.current;
    if (!el) return;
    sheetDim.current = axis() === 'x' ? el.offsetWidth : el.offsetHeight;
    closedPos.current = sheetDim.current + 40;
  }, [axis]);

  const finishClose = useCallback(() => {
    scrimRef.current?.classList.remove('live');
    if (scrimRef.current) scrimRef.current.style.opacity = '0';
    openState.current = false;
    setRender(null);
  }, []);

  useEffect(() => {
    const s = new Spring(0, {
      response: 0.34,
      damping: 0.82,
      epsilon: 0.15, // pixel-valued: no point chasing the last hundredth
      onframe: (p, _v, settled) => {
        const el = sheetRef.current;
        if (el) el.style.transform = axis() === 'x' ? `translateX(${p}px)` : `translateY(${p}px)`;
        const t = 1 - clamp(p / (closedPos.current || 1), 0, 1);
        if (scrimRef.current) scrimRef.current.style.opacity = String(0.5 * t);
        if (settled && p >= closedPos.current - 0.5 && openState.current === 'closing') finishClose();
      },
    });
    springRef.current = s;
    return () => {
      s.stop();
    };
  }, [axis, finishClose]);

  const closeSheet = useCallback(
    (velocity = 0) => {
      if (!openState.current) return;
      openState.current = 'closing';
      measure();
      springRef.current?.set(0.3, 1.0).to(closedPos.current, velocity);
    },
    [measure],
  );

  /* open / close driven by the prop */
  useEffect(() => {
    if (context) {
      genRef.current += 1;
      openState.current = true;
      setRender({ ctx: context, gen: genRef.current });
    } else if (openState.current === true) {
      closeSheet(600);
    }
  }, [context, closeSheet]);

  /* entrance — runs after the content has actually been committed, so the
     measurement is of the real panel and not an empty one */
  useEffect(() => {
    if (!render || openState.current !== true) return;
    const el = sheetRef.current;
    if (!el) return;
    el.style.transform = axis() === 'x' ? 'translateX(105%)' : 'translateY(105%)';
    scrimRef.current?.classList.add('live');
    const id = requestAnimationFrame(() => {
      measure();
      const s = springRef.current;
      if (!s) return;
      s.set(0.34, 0.82);
      s.stop();
      s.x = closedPos.current;
      s.to(0, -1400);
    });
    return () => cancelAnimationFrame(id);
  }, [render, axis, measure]);

  /* if the breakpoint flips while open, snap to the new geometry */
  useEffect(() => {
    if (openState.current !== true) return;
    const el = sheetRef.current;
    if (el) el.style.transform = isDesktop ? 'translateX(0px)' : 'translateY(0px)';
    const s = springRef.current;
    if (s) {
      s.stop();
      s.x = 0;
    }
  }, [isDesktop]);

  /* Escape closes */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openState.current === true) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* ---- drag: 1:1 tracking, velocity history, rubber-band ---- */
  const dragging = useRef(false);
  const startPointer = useRef(0);
  const startSheet = useRef(0);
  const vHist = useRef<{ t: number; p: number }[]>([]);

  const coord = (e: React.PointerEvent) => (axis() === 'x' ? e.clientX : e.clientY);

  const currentPos = () => {
    const el = sheetRef.current;
    if (!el) return 0;
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return axis() === 'x' ? m.m41 || 0 : m.m42 || 0;
  };

  const onDown = (e: React.PointerEvent) => {
    if (openState.current !== true) return;
    measure();
    dragging.current = true;
    springRef.current?.stop();
    startPointer.current = coord(e);
    startSheet.current = currentPos();
    vHist.current = [{ t: performance.now(), p: startPointer.current }];
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    let pos = startSheet.current + (coord(e) - startPointer.current);
    if (pos < 0) pos = -rubberband(-pos, sheetDim.current);
    const el = sheetRef.current;
    if (el) el.style.transform = axis() === 'x' ? `translateX(${pos}px)` : `translateY(${pos}px)`;
    if (scrimRef.current) {
      scrimRef.current.style.opacity = String(0.5 * (1 - clamp(pos / closedPos.current, 0, 1)));
    }
    vHist.current.push({ t: performance.now(), p: coord(e) });
    if (vHist.current.length > 6) vHist.current.shift();
  };

  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const pos = currentPos();
    const h = vHist.current;
    let vel = 0;
    if (h.length > 1) {
      const dt = (h[h.length - 1].t - h[0].t) / 1000;
      if (dt > 0) vel = (h[h.length - 1].p - h[0].p) / dt;
    }
    const s = springRef.current;
    if (!s) return;
    s.x = pos;
    s.v = vel;
    // a flick that would coast past a third of the way out closes it
    if (pos + project(vel) > closedPos.current * 0.32 || vel > 550) onClose();
    else s.set(0.34, 0.8).to(0, vel);
  };

  const ctx = render?.ctx ?? null;

  return (
    <>
      <div className="scrim" ref={scrimRef} onClick={() => onClose()} />
      <div className="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label="Review before it ships">
        <div
          className="grabber-zone"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div className="grabber" />
        </div>
        <div className="sheet-head">{ctx ? renderHead(ctx) : null}</div>
        <div className="sheet-body">{ctx ? renderBody(ctx) : null}</div>
        <div className="sheet-foot">
          <button type="button" className="ghost-btn" onClick={() => ctx && onEdit(ctx)}>
            Ask for a change
          </button>
          <button type="button" className="cta" onClick={() => ctx && onApprove(ctx)}>
            <span>{ctx ? approveLabel(ctx) : 'Approve'}</span>
          </button>
        </div>
      </div>
    </>
  );
}
