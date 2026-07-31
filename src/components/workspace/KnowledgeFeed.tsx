'use client';

import { useCallback, useRef, useState } from 'react';
import { paths, patchFact } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import type { Fact, FactList, Period } from '@/lib/api/types';

/* What Allya has noticed about this surface. Flagging and correcting a fact
   go back to the server — the founder correcting the model is the point, so
   it can't be a local-only gesture. */

const TABS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last-week', label: 'Last week' },
];

const CalIcon = () => (
  <svg className="kf-cal-icon" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M2 6.5h12M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const FlagIcon = () => (
  <svg className="kf-flag-icon" viewBox="0 0 16 16" fill="none">
    <path d="M3 2v12M3 2l9 4-9 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function KnowledgeFeed({ surfaceId, title }: { surfaceId: string | null; title: string }) {
  const [period, setPeriod] = useState<Period>('today');
  const [calOpen, setCalOpen] = useState(false);
  const [calDate, setCalDate] = useState<string | null>(null);
  // server truth, plus whatever this session has changed since
  const [edits, setEdits] = useState<Record<string, Fact>>({});

  const res = useResource<FactList>(
    surfaceId ? paths.knowledge(surfaceId, calDate ? null : period, calDate) : null,
  );

  const apply = useCallback((f: Fact) => setEdits((e) => ({ ...e, [f.id]: f })), []);

  const toggleFlag = useCallback(
    (f: Fact) => {
      apply({ ...f, flagged: !f.flagged }); // optimistic — it's a toggle
      patchFact(f.id, { flagged: !f.flagged }).then(apply).catch(() => apply(f));
    },
    [apply],
  );

  const correct = useCallback(
    (f: Fact, text: string) => patchFact(f.id, { text }).then(apply).catch(() => {}),
    [apply],
  );

  const facts = (res.data?.facts ?? []).map((f) => edits[f.id] ?? f);

  return (
    <div className="c-sec learnt">
      <div className="kf-header">
        <div className="group-label">{title}</div>
        <div className="kf-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`kf-tab${period === t.key && !calDate ? ' active' : ''}`}
              onClick={() => {
                setPeriod(t.key);
                setCalDate(null);
                setCalOpen(false);
              }}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            className={`kf-tab kf-tab-cal${calDate ? ' active' : ''}`}
            aria-label="Pick a date"
            onClick={() => setCalOpen((o) => !o)}
          >
            <CalIcon />
          </button>
        </div>
      </div>

      {calOpen && (
        <div className="kf-cal-picker">
          <input
            type="date"
            className="kf-date-input"
            value={calDate ?? ''}
            onChange={(e) => {
              setCalDate(e.target.value || null);
              setCalOpen(false);
            }}
          />
        </div>
      )}

      <div className="kf-feed">
        {res.loading ? (
          <div className="sk-list">
            {[0, 1, 2, 3].map((i) => (
              <div className="sk-line" key={i} />
            ))}
          </div>
        ) : res.error ? (
          <p className="kf-empty">
            Couldn&rsquo;t load this.{' '}
            <button type="button" className="link-btn" onClick={res.reload}>
              Try again
            </button>
          </p>
        ) : facts.length ? (
          facts.map((f) => <FactRow key={f.id} fact={f} onFlag={toggleFlag} onCorrect={correct} />)
        ) : (
          <p className="kf-empty">Nothing logged for this period yet.</p>
        )}
      </div>
    </div>
  );
}

function FactRow({
  fact,
  onFlag,
  onCorrect,
}: {
  fact: Fact;
  onFlag: (f: Fact) => void;
  onCorrect: (f: Fact, text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className={`kf-row${fact.mismatch ? ' kf-mismatch' : ''}${fact.flagged ? ' kf-flagged' : ''}`}>
        <span className="kf-text">{fact.text}</span>
        <button type="button" className="kf-flag" aria-label="Flag this fact" onClick={() => onFlag(fact)}>
          <FlagIcon />
        </button>
      </div>
      {fact.flagged && (
        <div className="kf-correct">
          <input ref={inputRef} type="text" className="kf-input" placeholder="What's correct?" />
          <button
            type="button"
            className="kf-save"
            onClick={() => {
              const val = inputRef.current?.value.trim();
              if (val) onCorrect(fact, val);
            }}
          >
            Update
          </button>
        </div>
      )}
    </>
  );
}
