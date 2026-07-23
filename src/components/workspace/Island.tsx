'use client';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Spring } from '@/lib/spring';
import { useReducedMotion, useTimers } from '@/lib/hooks';
import type { WorkItem } from '@/lib/workspace-data';

/* ============================================================
   Dynamic island — a split pill pinned to the top of the Talk pane.
   Left: KPIs, stepping one at a time on a spring. Right: the to-do
   list in continuous motion, driven by a CSS animation so the
   compositor carries it instead of a per-frame rAF.
   ============================================================ */

const ROW = 40; // island height / row height
const SCROLL_PX_PER_SEC = 22;

function shortTitle(w: WorkItem) {
  if (w.id === 'newsletter') return 'Approve next week’s newsletter';
  if (w.status === 'needs-you') return `Review — ${w.title || 'waiting on you'}`;
  return (w.title || '').replace(
    / from last week’s signups| against your approved JD| matched to your space/,
    '',
  );
}

export function Island({ work, onOpenTodo }: { work: WorkItem[]; onOpenTodo: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const springRef = useRef<Spring | null>(null);
  const idxRef = useRef(0);
  const reduced = useReducedMotion();
  const { after, clearAll } = useTimers();

  const kpis = useMemo(() => {
    const running = work.filter((w) => w.status === 'running').length;
    const needs = work.filter((w) => w.status === 'needs-you').length;
    const shipped = work.filter((w) => w.status === 'shipped').length + 12; // +12 earlier this week
    return [
      { n: String(shipped), l: 'shipped this week' },
      { n: String(running), l: running === 1 ? 'agent running' : 'agents running' },
      { n: String(needs), l: needs === 1 ? 'thing needs you' : 'things need you' },
      { n: '₹0', l: 'spent · first month free' },
    ];
  }, [work]);

  const todos = useMemo(() => {
    const needs = work.filter((w) => w.status === 'needs-you').map((w) => ({ needs: true, t: shortTitle(w) }));
    const running = work.filter((w) => w.status === 'running').map((w) => ({ needs: false, t: shortTitle(w) }));
    const list = [...needs, ...running];
    return list.length ? list : [{ needs: false, t: 'All clear — nothing waiting' }];
  }, [work]);

  const loopH = todos.length * ROW;

  useEffect(() => {
    const s = new Spring(0, {
      response: 0.5,
      damping: 0.85,
      onframe: (y) => {
        if (trackRef.current) trackRef.current.style.transform = `translateY(${-y}px)`;
      },
    });
    springRef.current = s;
    return () => {
      s.stop();
    };
  }, []);

  const home = () => {
    const s = springRef.current;
    idxRef.current = 0;
    if (s) {
      s.stop();
      s.x = 0;
      s.target = 0;
      s.v = 0;
    }
    if (trackRef.current) trackRef.current.style.transform = 'translateY(0px)';
  };

  // the list changed under us — start again from the top
  useEffect(home, [kpis]);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      const s = springRef.current;
      if (!s || document.hidden) return;
      idxRef.current += 1;
      s.to(idxRef.current * ROW);
      // landed on the appended clone → snap home once it's out of sight
      if (idxRef.current >= kpis.length) after(520, home);
    }, 3200);
    return () => {
      clearInterval(id);
      clearAll();
    };
  }, [kpis.length, reduced, after, clearAll]);

  // the track carries a clone of the first item so the wrap is seamless
  const kpiCells = [...kpis, kpis[0]];

  return (
    <div className="island-wrap">
      <div className="island" aria-label="Live status">
        <div className="isl-cell isl-kpi">
          <span className="isl-dot" />
          <div className="kpi-track">
            <div ref={trackRef}>
              {kpiCells.map((k, i) => (
                <div key={`${k.l}-${i}`} className="kpi-item" style={{ transform: `translateY(${i * ROW}px)` }}>
                  <span>
                    <b>{k.n}</b> {k.l}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button type="button" className="isl-cell isl-todo" aria-label="Open what needs you" onClick={onOpenTodo}>
          <span className="todo-tag">to-do</span>
          <div className="todo-track">
            <div
              className="todo-list"
              style={
                {
                  '--loop': `-${loopH}px`,
                  animation: reduced ? 'none' : `todo-scroll ${loopH / SCROLL_PX_PER_SEC}s linear infinite`,
                } as CSSProperties
              }
            >
              {/* the list is duplicated so the upward scroll is seamless */}
              {[...todos, ...todos].map((t, i) => (
                <div key={`${t.t}-${i}`} className="todo-item">
                  <span className={`td-dot${t.needs ? ' needs' : ''}`} />
                  {t.t}
                </div>
              ))}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
