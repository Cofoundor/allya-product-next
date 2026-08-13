'use client';

import type { Person, Segment, Warmth } from '@/lib/api/types';
import { useLexicon } from '@/lib/crm/lexicon';

/* ============================================================
   The right-hand pane: everyone, in the order a founder wants them.

   Three buckets, the way the campaign pane has three, and for the same
   reason — they answer different questions and one should never push
   another off the screen:

   "Needs you" is somebody a person has to deal with: warm, mid-stage,
   waiting. "Warm" is everyone else who has been touched lately. "Cold"
   is the long tail you leave alone on purpose, kept visible so leaving
   them alone stays a decision rather than an accident.
   ============================================================ */

/* The warmth words came from a constant here, spelled differently to the two
   other copies elsewhere in the app. They're the API's vocabulary now. */

function initials(name: string) {
  const parts = name.replace(/[^\p{L}\s.—-]/gu, '').split(/[\s—-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

const today = () => new Date().toISOString().slice(0, 10);

/** a date said the way a person would say it */
function saidDue(due: string) {
  const d = new Date(`${due}T00:00:00`);
  const now = new Date();
  const days = Math.round((d.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400_000);
  if (days < -1) return `${-days} days late`;
  if (days === -1) return 'yesterday — late';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return due;
}

function Row({ p, onOpen, warmthSaid }: {
  p: Person;
  onOpen: (id: string) => void;
  warmthSaid: (w: Warmth) => string;
}) {
  return (
    <button type="button" className={`pl-row${p.overdue ? ' is-late' : ''}`} onClick={() => onOpen(p.id)}>
      <span className={`pl-av w-${p.warmth}`} aria-hidden>
        {initials(p.name)}
      </span>
      <span className="pl-row-body">
        <span className="pl-row-t">{p.name}</span>
        {/* what's owed outranks what Allya thinks of them: a queue is only
            a queue if the next thing is the thing you read first */}
        <span className="pl-row-m">
          {p.nextStep ? (
            <>
              <span className={`pl-due${p.overdue ? ' is-late' : ''}`}>
                {p.nextDue ? saidDue(p.nextDue) : 'owed'}
              </span>
              {p.nextStep}
            </>
          ) : (
            p.note || p.email || warmthSaid(p.warmth)
          )}
        </span>
      </span>
      {/* where they came in through — the distinction a flat source hid */}
      <span className="pl-row-src" title={p.originSaid}>
        {p.originChannel ?? '—'}
      </span>
    </button>
  );
}

export function PeoplePane({
  people,
  total,
  caption,
  segments,
  activeSegment,
  loading,
  error,
  onOpen,
  onSegment,
  onAdd,
  onImport,
  onRetry,
  onMore,
  hasMore,
}: {
  people: Person[];
  total: number;
  caption: string;
  segments: Segment[];
  activeSegment: string | null;
  loading: boolean;
  error: boolean;
  onOpen: (id: string) => void;
  onSegment: (id: string | null) => void;
  onAdd: () => void;
  onImport: () => void;
  onRetry: () => void;
  onMore: () => void;
  hasMore: boolean;
}) {
  /* The buckets that make this a queue rather than a temperature gauge.
     "Late" and "Due" come from real follow-up dates, so the top of the pane
     is what you actually owe today — and something can go overdue, which is
     the whole difference between a CRM and a contact list. */
  const { warmthSaid } = useLexicon();
  const t = today();
  const late = people.filter((p) => p.overdue);
  const due = people.filter((p) => !p.overdue && p.nextDue && p.nextDue <= t);
  const soon = people.filter((p) => !p.overdue && p.nextDue && p.nextDue > t);
  const rest = people.filter((p) => !p.nextStep);
  const warm = rest.filter((p) => p.warmth === 'warm' || p.warmth === 'cooling');
  const cold = rest.filter((p) => p.warmth === 'cold' || p.warmth === 'never');

  return (
    <>
      <div className="work-head pl-head-row">
        <h2>Everyone</h2>
        <span className="split-note">{loading ? 'reading…' : caption}</span>
      </div>

      <div className="pl-actions">
        <button type="button" className="es-create" onClick={onAdd}>
          <span className="es-create-plus">+</span> Add a person
        </button>
        {/* Table and Companies used to sit here. Switching the whole page is
            a chrome decision, so it moved to the header beside the status
            line; what's left is what acts on this pane. */}
        <button type="button" className="pl-ghost" onClick={onImport}>
          Upload a file
        </button>
      </div>

      {error ? (
        <div className="es-down">
          <p>Can’t reach the server — this pane is all live data.</p>
          <button type="button" className="cta" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}

      {/* the segments are the audiences marketing writes against, so they
          belong where the people are, not only in the campaign interview */}
      <div className="pl-segs" role="group" aria-label="Segments">
        <button
          type="button"
          className={`pl-seg${activeSegment ? '' : ' is-on'}`}
          onClick={() => onSegment(null)}
        >
          Everyone
        </button>
        {segments.map((s) => (
          <button
            type="button"
            key={s.id}
            className={`pl-seg${activeSegment === s.id ? ' is-on' : ''}`}
            onClick={() => onSegment(activeSegment === s.id ? null : s.id)}
            title={s.note || undefined}
          >
            {s.label} <b>{s.count}</b>
          </button>
        ))}
      </div>

      {late.length ? (
        <Section title="Late" note={`${late.length} overdue`} rows={late} onOpen={onOpen} warmthSaid={warmthSaid}
                 empty="" loading={loading} tone="late" />
      ) : null}
      <Section title="Owed" note={`${due.length + soon.length} with a date on them`}
               rows={[...due, ...soon]} onOpen={onOpen} warmthSaid={warmthSaid} loading={loading}
               empty="Nothing is owed. Take a move on someone and it lands here." />
      <Section title="Warm" note={`${warm.length} touched lately`} rows={warm} onOpen={onOpen} warmthSaid={warmthSaid}
               empty="Nobody has been spoken to recently." loading={loading} />
      <Section title="Cold" note={`${cold.length} left alone`} rows={cold} onOpen={onOpen} warmthSaid={warmthSaid}
               empty="Nobody has gone quiet." loading={loading}>
        {hasMore ? (
          <button type="button" className="pl-more" onClick={onMore}>
            Read more of the {total} →
          </button>
        ) : null}
      </Section>
    </>
  );
}

function Section({
  title,
  note,
  rows,
  onOpen,
  warmthSaid,
  empty,
  loading,
  tone,
  children,
}: {
  title: string;
  note: string;
  rows: Person[];
  onOpen: (id: string) => void;
  warmthSaid: (w: Warmth) => string;
  empty: string;
  loading: boolean;
  tone?: 'late';
  children?: React.ReactNode;
}) {
  return (
    <section className={`es-section pl-section${tone ? ` t-${tone}` : ''}`}>
      <div className="es-section-head">
        <h3>{title}</h3>
        <span>{loading ? 'reading…' : note}</span>
      </div>
      <div className="es-section-scroll">
        {rows.map((p) => (
          <Row key={p.id} p={p} onOpen={onOpen} warmthSaid={warmthSaid} />
        ))}
        {!loading && !rows.length ? <p className="es-empty">{empty}</p> : null}
        {children}
      </div>
    </section>
  );
}
