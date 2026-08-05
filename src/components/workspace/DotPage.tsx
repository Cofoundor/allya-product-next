'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { OpenNodeInfo } from '@/lib/brain';
import type { WorkItem } from '@/lib/api/types';
import { useReducedMotion } from '@/lib/hooks';

/* ============================================================
   Dot pages — every node in the brain is a place you can go.
   The brain re-centres on the tapped dot and fogs the rest; this is
   the page that grows out of it, flooded with that dot's colour.
   ============================================================ */

const DEPT_COPY: Record<string, string> = {
  marketing: 'How the market hears about you. Campaigns, content, and the story you keep telling.',
  hiring: 'Who joins, in what order, and what you promise them on day one.',
  pr: 'Who writes about you, and why now. Relationships before pitches.',
  sales: 'Where revenue actually comes from this month — not the theory of it.',
  ops: 'The plumbing: money out, time spent, decisions written down.',
  core: 'Everything Allya knows about your company, in one place.',
};

const STATUS: Record<string, string> = {
  'needs-you': 'Needs you',
  running: 'Running',
  shipped: 'Shipped',
};

interface DotPageProps {
  info: OpenNodeInfo | null;
  work: WorkItem[];
  onClose: () => void;
  onGoto: (id: string) => void;
  onAsk: (label: string) => void;
  /** group → what this place is, in Allya's words (the marketing brain has its own) */
  deptCopy?: Record<string, string>;
  /** what a department, a branch below one, and a leaf are called here */
  deptWord?: string;
  branchWord?: string;
  leafWord?: string;
  /** some dots are whole pages of their own — Marketing opens its own brain */
  deepLink?: (info: OpenNodeInfo) => { href: string; label: string; note?: string } | null;
  /** what this dot is, in one line, when the caller knows better than the
      generic "a thought Allya is holding" — a direction's page does */
  blurbFor?: (info: OpenNodeInfo) => string | null;
  /** the button at the bottom. Defaults to asking Allya about it; a page
      that can act on the dot says what the action is instead */
  ctaFor?: (info: OpenNodeInfo) => string;
}

export function DotPage({
  info,
  work,
  onClose,
  onGoto,
  onAsk,
  deptCopy = DEPT_COPY,
  deptWord = 'department',
  branchWord,
  leafWord = 'thought',
  deepLink,
  blurbFor,
  ctaFor,
}: DotPageProps) {
  const reduced = useReducedMotion();

  // Escape closes, and so does the browser's back button
  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [info, onClose]);

  if (!info) return null;

  // a place, not a thought: a department, or anything with a tree under it
  const dept = info.tier === 1 || info.children.length > 0;
  const deep = deepLink?.(info) ?? null;
  // work that belongs to this dot: its own, or any of its children's
  const ids = [info.work, ...info.children.map((c) => c.work)].filter(Boolean);
  const mine = work.filter((w) => ids.includes(w.id));

  // .dot-layer is position:fixed inset:0, so its origin is the viewport's —
  // the node's screen coords are already in the right space
  const [ox, oy] = info.origin;

  return (
    <div className="dot-layer is-open" style={{ ['--dot' as string]: info.color }}>
      <div className="dot-wash" onClick={onClose} />
      <section
        className="dot-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={info.label}
        style={
          reduced
            ? undefined
            : {
                // the sheet grows out of the node's position on screen
                ['--ox' as string]: `${ox}px`,
                ['--oy' as string]: `${oy}px`,
              }
        }
      >
        <div className="dot-scroll">
          <div className="dot-head">
            <button type="button" className="dot-back" onClick={onClose} aria-label="Back to the brain">
              ← The brain
            </button>
            <span className="dot-crumb">
              {info.parent ? `${info.parent} · ` : ''}
              {info.tier === 1 ? deptWord : dept ? branchWord ?? deptWord : leafWord}
            </span>
          </div>

          <h1 className="dot-title">{info.label}</h1>

          {dept ? (
            <>
              <p className="dot-blurb">{blurbFor?.(info) ?? deptCopy[info.group] ?? ''}</p>
              {deep ? (
                <Link className="dot-deep" href={deep.href} onClick={onClose}>
                  <span className="dd-copy">
                    <span className="dd-label">{deep.label}</span>
                    {deep.note ? <span className="dd-note">{deep.note}</span> : null}
                  </span>
                  <span className="dd-arrow">→</span>
                </Link>
              ) : null}
              {info.children.length ? <div className="dot-sec">On Allya&rsquo;s mind here</div> : null}
              <div className="dot-thoughts">
                {info.children.map((c) => (
                  <button type="button" className="dot-thought" key={c.id} onClick={() => onGoto(c.id)}>
                    <span className="dot-bullet" />
                    {c.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="dot-blurb">
              {blurbFor?.(info) ??
                `A thought Allya is holding under ${info.parent || 'your company'}. It stays here until it becomes work — or you tell her to drop it.`}
            </p>
          )}

          <div className="dot-sec">In flight</div>
          {mine.length ? (
            mine.map((w) => (
              <div className="dot-work" key={w.id}>
                <span className={`dot-status s-${w.status}`}>{STATUS[w.status] ?? w.status}</span>
                <div className="dot-work-copy">
                  <div className="t">{w.title || w.say}</div>
                  {w.meta ? <div className="m">{w.meta}</div> : null}
                </div>
              </div>
            ))
          ) : (
            <div className="dot-empty">Nothing running here right now. Ask Allya to start something.</div>
          )}

          <button type="button" className="dot-cta" onClick={() => onAsk(info.label)}>
            {ctaFor?.(info) ?? `Ask Allya about ${info.label.toLowerCase()} →`}
          </button>
        </div>
      </section>
    </div>
  );
}
