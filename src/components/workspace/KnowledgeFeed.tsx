'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'allya.knowledge';

interface KnowledgeFact {
  id: string;
  text: string;
  source: string;
  when: string;
  ts: number;
  flagged: boolean;
  mismatch?: boolean;
  removed?: boolean;
}

function seedKnowledge(): KnowledgeFact[] {
  const now = Date.now();
  const day = 86400000;
  return [
    { id: 'b1', text: 'You respond to PR approvals faster than hiring decisions', source: 'observed', when: 'today', ts: now, flagged: false },
    { id: 'b2', text: 'Newsletter open rate jumped 18% after switching to story format', source: 'observed', when: 'today', ts: now, flagged: false },
    { id: 'b3', text: 'Your ops role JD got 6 applicants in 4 hours — above average', source: 'observed', when: 'today', ts: now, flagged: false },
    { id: 'b4', text: "You haven't looked at the sales pipeline in 5 days", source: 'observed', when: 'today', ts: now, flagged: false, mismatch: true },
    { id: 'b5', text: 'Morning decisions stick — your afternoon reversals are 3× higher', source: 'observed', when: 'today', ts: now, flagged: false },
    { id: 'b6', text: 'CRM cleanup freed 41 duplicates — your lead count is now accurate', source: 'observed', when: 'today', ts: now, flagged: false },
    { id: 'y1', text: 'You approved the investor update without a single edit', source: 'observed', when: 'yesterday', ts: now - day, flagged: false },
    { id: 'y2', text: 'Press list v2 matched 8 more journalists vs v1', source: 'observed', when: 'yesterday', ts: now - day, flagged: false },
    { id: 'y3', text: 'You asked about annual pricing — might be exploring it', source: 'observed', when: 'yesterday', ts: now - day, flagged: false, mismatch: true },
    { id: 'y4', text: 'Three back-to-back calls drained your decision bandwidth', source: 'observed', when: 'yesterday', ts: now - day, flagged: false },
    { id: 'y5', text: 'Your hiring brief was the most detailed document this week', source: 'observed', when: 'yesterday', ts: now - day, flagged: false },
    { id: 'w1', text: 'You shipped 14 items — 9 agent, 5 expert-reviewed', source: 'observed', when: 'last-week', ts: now - day * 5, flagged: false },
    { id: 'w2', text: 'Average approval time dropped from 6h to 2h', source: 'observed', when: 'last-week', ts: now - day * 5, flagged: false },
    { id: 'w3', text: 'You ignored 2 outbound sequences — deprioritising cold outreach?', source: 'observed', when: 'last-week', ts: now - day * 4, flagged: false, mismatch: true },
    { id: 'w4', text: 'Hired your first ops contractor via the screening agent', source: 'observed', when: 'last-week', ts: now - day * 6, flagged: false },
    { id: 'w5', text: 'Revenue conversations shifted from "how much" to "when to raise"', source: 'observed', when: 'last-week', ts: now - day * 3, flagged: false },
    { id: 'w6', text: 'Your edge positioning resonated — 3 prospects quoted it back', source: 'observed', when: 'last-week', ts: now - day * 4, flagged: false },
  ];
}

function loadFacts(): KnowledgeFact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return seedKnowledge();
}

function saveFacts(facts: KnowledgeFact[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(facts)); } catch { /* ignore */ }
}

const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last-week', label: 'Last week' },
] as const;

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

export function KnowledgeFeed({ company }: { company?: string }) {
  const [facts, setFacts] = useState<KnowledgeFact[]>([]);
  const [filter, setFilter] = useState('today');
  const [calOpen, setCalOpen] = useState(false);
  const [calDate, setCalDate] = useState<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const loaded = loadFacts();
    setFacts(loaded);
    saveFacts(loaded);
  }, []);

  const persist = useCallback((next: KnowledgeFact[]) => {
    setFacts(next);
    saveFacts(next);
  }, []);

  const visible = calDate
    ? facts.filter(f => {
        if (f.removed) return false;
        const d = new Date(calDate);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        return f.ts >= start && f.ts < start + 86400000;
      })
    : facts.filter(f => !f.removed && f.when === filter);

  const toggleFlag = useCallback((id: string) => {
    setFacts(prev => {
      const next = prev.map(f => f.id === id ? { ...f, flagged: !f.flagged } : f);
      saveFacts(next);
      return next;
    });
  }, []);

  const correct = useCallback((id: string, text: string) => {
    setFacts(prev => {
      const next = prev.map(f =>
        f.id === id ? { ...f, text, flagged: false, mismatch: false, source: 'corrected' } : f,
      );
      saveFacts(next);
      return next;
    });
  }, []);

  return (
    <div className="c-sec learnt">
      <div className="kf-header">
        <div className="group-label">What I know</div>
        <div className="kf-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              className={`kf-tab${filter === t.key && !calDate ? ' active' : ''}`}
              onClick={() => { setFilter(t.key); setCalDate(null); setCalOpen(false); }}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            className={`kf-tab kf-tab-cal${calDate ? ' active' : ''}`}
            onClick={() => setCalOpen(o => !o)}
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
            onChange={e => {
              setCalDate(e.target.value || null);
              setCalOpen(false);
            }}
          />
        </div>
      )}

      <div className="kf-feed">
        {visible.length ? (
          visible.map(f => (
            <FactRow key={f.id} fact={f} onFlag={toggleFlag} onCorrect={correct} />
          ))
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
  fact: KnowledgeFact;
  onFlag: (id: string) => void;
  onCorrect: (id: string, text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className={`kf-row${fact.mismatch ? ' kf-mismatch' : ''}${fact.flagged ? ' kf-flagged' : ''}`}>
        <span className="kf-text">{fact.text}</span>
        <button type="button" className="kf-flag" aria-label="Flag this fact" onClick={() => onFlag(fact.id)}>
          <FlagIcon />
        </button>
      </div>
      {fact.flagged && (
        <div className="kf-correct">
          <input
            ref={inputRef}
            type="text"
            className="kf-input"
            placeholder="What's correct?"
          />
          <button
            type="button"
            className="kf-save"
            onClick={() => {
              const val = inputRef.current?.value.trim();
              if (val) onCorrect(fact.id, val);
            }}
          >
            Update
          </button>
        </div>
      )}
    </>
  );
}
