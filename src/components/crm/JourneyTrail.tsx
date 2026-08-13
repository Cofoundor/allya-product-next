'use client';

import { useMemo } from 'react';
import { PersonIcon } from '@/components/icons';
import type { Touch } from '@/lib/api/types';
import { useLexicon } from '@/lib/crm/lexicon';

/* ============================================================
   The journey: everything that ever happened to one person.

   It borrows the review sheet's trail grammar on purpose. That trail
   exists to answer "who touched this, in what order" for one piece of
   work; this answers the same question for one human, across every
   floor. The dot is the same dot, so the 85/15 seam reads the same way
   on a customer record as it does on a draft.

   Grouped by day, newest first — a founder scanning this is asking
   "what's happened lately", not "what happened first".
   ============================================================ */

/** what each kind is, said before the sentence rather than inside it */
/* The word each touch kind reads with comes from GET /crm/lexicon — the
   API owns the enum, so it owns what the enum is called. */

const DAY = 86400_000;

function dayLabel(ts: number) {
  const then = new Date(ts * 1000);
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.floor((midnight - new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / DAY);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: then.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

const time = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export function JourneyTrail({
  touches,
  loading,
  onOpenWork,
}: {
  touches: Touch[];
  loading?: boolean;
  onOpenWork?: (workId: string) => void;
}) {
  const { touchWord } = useLexicon();
  const days = useMemo(() => {
    const out: { label: string; rows: Touch[] }[] = [];
    for (const t of touches) {
      const label = dayLabel(t.at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(t);
      else out.push({ label, rows: [t] });
    }
    return out;
  }, [touches]);

  if (loading) {
    return (
      <div className="sk-list">
        {[0, 1, 2].map((i) => (
          <div className="sk-block" key={i} />
        ))}
      </div>
    );
  }

  if (!touches.length) {
    return (
      <p className="es-empty">
        Nothing has happened to them yet. The first thing that does will land here.
      </p>
    );
  }

  return (
    <div className="pl-journey">
      {days.map((d) => (
        <div className="pl-day" key={d.label}>
          <div className="pl-day-mark">{d.label}</div>
          <div className="trail">
            {d.rows.map((t) => (
              <div className={`trail-row${t.by === 'you' ? ' now' : ''}`} key={t.id}>
                <span className={`t-dot ${t.by}`}>{t.by === 'expert' ? <PersonIcon /> : null}</span>
                <span className="t-txt">
                  <span className="pl-t-kind">{touchWord(t.kind)}</span>
                  {t.text}
                  {t.who ? <span className="pl-t-who"> · {t.who}</span> : null}
                  {t.workId && onOpenWork ? (
                    <button type="button" className="trail-toggle" onClick={() => onOpenWork(t.workId!)}>
                      see the work
                    </button>
                  ) : null}
                </span>
                <span className="t-time">{time(t.at)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
