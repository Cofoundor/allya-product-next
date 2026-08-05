'use client';

import type { ChannelPage, Nouns, Send, WorkItem } from '@/lib/api/types';

/* ============================================================
   The right-hand pane: what's running, and what already ran.

   Two sections that scroll separately, because they answer different
   questions and one should never push the other off the screen. Above
   them the one button this page exists for.

   Three of them, because a campaign is in one of three places and they
   are not the same question:

   "Pending" is waiting on somebody — you, or an approval elsewhere.
   "Active" is settled and coming: scheduled, plus the automations that
   run without anyone. "Past" is what already went out.
   ============================================================ */

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function CampaignPane({
  page,
  campaigns,
  work,
  nouns,
  loading,
  error,
  onCreate,
  onOpen,
  onRetry,
}: {
  page: ChannelPage | null;
  campaigns: Send[];
  work: WorkItem[];
  nouns: Nouns | null;
  loading: boolean;
  error: boolean;
  onCreate: () => void;
  onOpen: (s: Send) => void;
  onRetry: () => void;
}) {
  const needs = work.filter((w) => w.status === 'needs-you');
  const waits = (c: Send) => !!c.workId && needs.some((w) => w.id === c.workId);

  /* Pending is "waiting on somebody": a draft, or anything held behind a
     work item that needs you — which is a campaign you can open, not a
     note you can only read. Active is what's settled and coming. */
  const pending = campaigns.filter((s) => s.state === 'draft' || waits(s));
  const active = campaigns.filter((s) => s.state === 'scheduled' && !waits(s));
  const past = campaigns.filter((s) => s.state === 'sent');
  const best = Math.max(0.01, ...past.map((s) => s.openRate));
  // a work item with no campaign of its own still has to be shown somewhere
  const loose = needs.filter((w) => !campaigns.some((c) => c.workId === w.id));

  return (
    <>
      <div className="work-head">
        <h2>The work</h2>
        <span className="split-note">
          {pending.length} pending · {active.length} active · {past.length} past
        </span>
      </div>

      <button type="button" className="es-create" onClick={onCreate}>
        <span className="es-create-plus">+</span> Create a campaign
      </button>

      {error ? (
        <div className="es-down">
          <p>Can’t reach the server — this pane is all live data.</p>
          <button type="button" className="cta" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}

      <section className="es-section">
        <div className="es-section-head">
          <h3>Pending campaigns</h3>
          <span>{loading ? 'reading…' : `${pending.length + loose.length} waiting on you`}</span>
        </div>
        <div className="es-section-scroll">
          {loose.map((w) => (
            <div className="es-wait-row" key={w.id}>
              <span className="brain-live" />
              <span className="es-wait-copy">{w.say ?? w.title}</span>
              <span className="es-pill s-draft">needs you</span>
            </div>
          ))}
          {pending.map((s) => (
            <button type="button" className="es-row is-open" key={s.id} onClick={() => onOpen(s)}>
              <span className="es-row-t">{s.subject}</span>
              <span className="es-row-m">
                {s.outcome ?? `${s.when} · ${s.audience.toLowerCase()}`}
              </span>
              <span className={`es-pill ${waits(s) ? 's-draft' : `s-${s.state}`}`}>
                {waits(s) ? 'needs you' : s.state}
              </span>
            </button>
          ))}
          {!loading && !pending.length && !loose.length ? (
            <p className="es-empty">Nothing waiting on you.</p>
          ) : null}
        </div>
      </section>

      <section className="es-section">
        <div className="es-section-head">
          <h3>Active campaigns</h3>
          <span>{loading ? 'reading…' : `${active.length + (page?.sequences.length ?? 0)} in flight`}</span>
        </div>
        <div className="es-section-scroll">
          {active.map((s) => (
            <button type="button" className="es-row is-open" key={s.id} onClick={() => onOpen(s)}>
              <span className="es-row-t">{s.subject}</span>
              <span className="es-row-m">
                {s.when} · {s.audience.toLowerCase()}
              </span>
              <span className={`es-pill s-${s.state}`}>{s.state}</span>
            </button>
          ))}

          {page?.sequences.length ? (
            <>
              <div className="es-label es-sec-sub">Running without you</div>
              {page.sequences.map((q) => (
                <div className="es-row" key={q.id}>
                  <span className="es-row-t">{q.name}</span>
                  <span className="es-row-m">
                    {q.trigger} · {q.stat}
                  </span>
                  <span className={`es-pill s-${q.state}`}>{q.state}</span>
                </div>
              ))}
            </>
          ) : null}

          {!loading && !error && !active.length && !page?.sequences.length ? (
            <p className="es-empty">Nothing running. The first {nouns?.one ?? 'campaign'} is one button away.</p>
          ) : null}
        </div>
      </section>

      <section className="es-section">
        <div className="es-section-head">
          <h3>Past campaigns</h3>
          <span>{nouns?.metric ?? 'opened'}, against your best</span>
        </div>
        <div className="es-section-scroll">
          {past.map((s) => (
            <button type="button" className="es-send is-open" key={s.id} onClick={() => onOpen(s)}>
              <span className="es-send-top">
                <span className="es-row-t">{s.subject}</span>
                <span className="es-send-o">{pct(s.openRate)}</span>
              </span>
              <span className="es-bar">
                <span style={{ width: `${(s.openRate / best) * 100}%` }} />
              </span>
              <span className="es-row-m">
                {s.when} · {s.sent} out · {s.replies} {s.replies === 1 ? 'reply' : 'replies'}
              </span>
            </button>
          ))}
          {!loading && !past.length ? <p className="es-empty">Nothing has gone out yet.</p> : null}
        </div>
      </section>
    </>
  );
}
