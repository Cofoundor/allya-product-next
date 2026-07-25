'use client';

import { useEffect } from 'react';
import type { OpenNodeInfo } from '@/lib/brain';
import type { WorkItem } from '@/lib/workspace-data';
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
}

export function DotPage({ info, work, onClose, onGoto, onAsk }: DotPageProps) {
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

  const dept = info.tier === 1;
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
              {dept ? 'department' : 'thought'}
            </span>
          </div>

          <h1 className="dot-title">{info.label}</h1>

          {dept ? (
            <>
              <p className="dot-blurb">{DEPT_COPY[info.group] ?? ''}</p>
              <div className="dot-sec">On Allya&rsquo;s mind here</div>
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
              A thought Allya is holding under {info.parent || 'your company'}. It stays here until it
              becomes work — or you tell her to drop it.
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
            Ask Allya about {info.label.toLowerCase()} →
          </button>
        </div>
      </section>
    </div>
  );
}
