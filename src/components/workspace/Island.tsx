'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Spring } from '@/lib/spring';
import { useReducedMotion, useTimers } from '@/lib/hooks';
import { IslandCalendar } from './IslandCalendar';
import type { WorkItem, WorkSummary } from '@/lib/api/types';

/* ============================================================
   Dynamic island — a split pill pinned to the top of the Talk pane.
   Left: KPIs, stepping one at a time on a spring. Right: the to-do
   list in continuous motion, driven by a CSS animation so the
   compositor carries it instead of a per-frame rAF.

   Both tickers travel HORIZONTALLY. Tapping either half springs the
   same element open into a panel — the way iOS's Dynamic Island
   grows, not a separate popup — and each half of the expanded panel
   scrolls on its own.
   ============================================================ */

const SCROLL_PX_PER_SEC = 34;

function shortTitle(w: WorkItem) {
  if (w.status === 'needs-you') return `Review — ${w.title ?? w.whoRole ?? 'waiting on you'}`;
  // the ticker has one line; trim the qualifying clause off the end
  return (w.title ?? '').replace(/ (from|against|matched|across|for) .*$/, '');
}

interface IslandProps {
  /** whose calendar the left half shows — the workspace sees every floor's */
  surfaceId: string;
  work: WorkItem[];
  /** the two counters the work list can't derive on its own */
  summary: WorkSummary | null;
  /** open an item's approval sheet from the expanded panel */
  onOpenWork: (id: string) => void;
}

export function Island({ surfaceId, work, summary, onOpenWork }: IslandProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const kpiWinRef = useRef<HTMLDivElement>(null);
  const todoRef = useRef<HTMLDivElement>(null);
  const islandRef = useRef<HTMLDivElement>(null);
  const springRef = useRef<Spring | null>(null);
  const idxRef = useRef(0);
  const cellRef = useRef(0); // step distance = the KPI window's width
  const reduced = useReducedMotion();
  const { after, clearAll } = useTimers();

  const [open, setOpen] = useState(false);
  const [loopW, setLoopW] = useState(0);

  const kpis = useMemo(() => {
    const running = work.filter((w) => w.status === 'running').length;
    const needs = work.filter((w) => w.status === 'needs-you').length;
    const shipped = work.filter((w) => w.status === 'shipped').length + (summary?.shippedEarlier ?? 0);
    return [
      { n: String(shipped), l: 'shipped this week' },
      { n: String(running), l: running === 1 ? 'agent running' : 'agents running' },
      { n: String(needs), l: needs === 1 ? 'thing needs you' : 'things need you' },
      { n: summary?.spendLabel ?? '—', l: summary?.spendNote ?? 'spend' },
    ];
  }, [work, summary]);

  const todos = useMemo(() => {
    const needs = work.filter((w) => w.status === 'needs-you').map((w) => ({ needs: true, t: shortTitle(w) }));
    const running = work.filter((w) => w.status === 'running').map((w) => ({ needs: false, t: shortTitle(w) }));
    const list = [...needs, ...running];
    return list.length ? list : [{ needs: false, t: 'All clear — nothing waiting' }];
  }, [work]);

  useEffect(() => {
    const s = new Spring(0, {
      response: 0.5,
      damping: 0.85,
      onframe: (x) => {
        if (trackRef.current) trackRef.current.style.transform = `translateX(${-x}px)`;
      },
    });
    springRef.current = s;
    return () => {
      s.stop();
    };
  }, []);

  const home = useCallback(() => {
    const s = springRef.current;
    idxRef.current = 0;
    if (s) {
      s.stop();
      s.x = 0;
      s.target = 0;
      s.v = 0;
    }
    if (trackRef.current) trackRef.current.style.transform = 'translateX(0px)';
  }, []);

  // the list changed under us — start again from the first cell
  useEffect(home, [kpis, home]);

  /* Measure the loop distance from real laid-out content, synchronously.
     A rAF here silently never fires in a backgrounded tab and the ticker
     would never start. useLayoutEffect runs after DOM mutation, before paint. */
  useLayoutEffect(() => {
    const measure = () => {
      if (kpiWinRef.current) cellRef.current = kpiWinRef.current.clientWidth || 0;
      if (todoRef.current) {
        const w = todoRef.current.scrollWidth / 2; // one copy of the duplicated list
        if (w) setLoopW(w);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [todos, kpis]);

  useEffect(() => {
    if (reduced || open) return; // paused while the panel is up
    const id = setInterval(() => {
      const s = springRef.current;
      if (!s || document.hidden) return;
      if (!cellRef.current && kpiWinRef.current) cellRef.current = kpiWinRef.current.clientWidth || 0;
      idxRef.current += 1;
      s.to(idxRef.current * cellRef.current);
      // landed on the appended clone → snap home once it's out of sight
      if (idxRef.current >= kpis.length) after(520, home);
    }, 3200);
    return () => {
      clearInterval(id);
      clearAll();
    };
  }, [kpis.length, reduced, open, after, clearAll, home]);

  // click-outside and Escape collapse the panel
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (islandRef.current && !islandRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  // the track carries a clone of the first item so the wrap is seamless
  const kpiCells = [...kpis, kpis[0]];

  const needsYou = work.filter((w) => w.status === 'needs-you');
  const running = work.filter((w) => w.status === 'running');
  const shipped = work.filter((w) => w.status === 'shipped');

  const row = (w: WorkItem, tag: string) => (
    <button
      type="button"
      className="idet-row"
      key={w.id}
      onClick={() => {
        setOpen(false);
        onOpenWork(w.id);
      }}
    >
      <span className={`td-dot${w.status === 'needs-you' ? ' needs' : ''}`} />
      <span className="idet-copy">
        <span className="idet-t">{w.title || w.say || ''}</span>
        {w.meta ? <span className="idet-m">{w.meta}</span> : null}
      </span>
      <span className={`pill${w.origin === 'expert' ? ' expert' : ''}`}>{tag}</span>
    </button>
  );

  return (
    <div className="island-wrap">
      <div
        className={`island${open ? ' is-open' : ''}`}
        aria-label="Live status"
        aria-expanded={open}
        ref={islandRef}
      >
        <div className="isl-row">
          <div
            className="isl-cell isl-kpi"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            <span className="isl-dot" />
            <div className="kpi-track" ref={kpiWinRef}>
              {/* kpi-slide must fill the track: it carries the transform, which
                  makes it the containing block for the absolutely positioned
                  cells. Left at its natural height (zero, since every child is
                  absolute) the cells collapse onto the top edge and the pill
                  clips their upper half. */}
              <div className="kpi-slide" ref={trackRef}>
                {kpiCells.map((k, i) => (
                  <div key={`${k.l}-${i}`} className="kpi-item" style={{ transform: `translateX(${i * 100}%)` }}>
                    <span>
                      <b>{k.n}</b> {k.l}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="isl-cell isl-todo"
            aria-label="Expand live status"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            <span className="todo-tag">to-do</span>
            <div className="todo-track">
              <div
                className="todo-list"
                ref={todoRef}
                /* longhand only — mixing the `animation` shorthand with
                   animationPlayState makes React warn about conflicting
                   properties on re-render */
                style={
                  {
                    '--loop': `-${loopW}px`,
                    animationName: reduced || !loopW ? 'none' : 'todo-scroll',
                    animationDuration: `${loopW / SCROLL_PX_PER_SEC}s`,
                    animationTimingFunction: 'linear',
                    animationIterationCount: 'infinite',
                    animationPlayState: open ? 'paused' : 'running',
                  } as CSSProperties
                }
              >
                {/* the list is duplicated so the sideways scroll is seamless */}
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

        {/* grows out of the pill when expanded; both panes scroll */}
        <div className="island-detail">
          {/* the left half is the calendar and nothing else — the counters it
              used to carry are already the collapsed pill's whole job */}
          <div className="idet-pane idet-left">
            <IslandCalendar
              surfaceId={surfaceId}
              onOpenWork={(id) => {
                setOpen(false);
                onOpenWork(id);
              }}
            />
          </div>

          <div className="idet-pane idet-right">
            {needsYou.length ? (
              <>
                <div className="idet-group">Needs you</div>
                {needsYou.map((w) => row(w, 'you'))}
              </>
            ) : null}
            {running.length ? (
              <>
                <div className="idet-group">Running</div>
                {running.map((w) => row(w, w.origin || 'agent'))}
              </>
            ) : null}
            {shipped.length ? (
              <>
                <div className="idet-group">Shipped today</div>
                {shipped.map((w) => row(w, w.origin || 'agent'))}
              </>
            ) : null}
            {!needsYou.length && !running.length && !shipped.length ? (
              <div className="idet-empty">All clear — nothing waiting.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
