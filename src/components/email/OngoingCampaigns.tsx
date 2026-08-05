'use client';

import type { EmailPage, WorkItem } from '@/lib/api/types';

/* ============================================================
   Everything already in flight.

   Three kinds of ongoing: the send that's queued, the sequences that run
   without anyone touching them, and whatever email work is waiting on the
   founder right now. All of it live from the API — this box invents
   nothing, which is why an empty one is worth showing.
   ============================================================ */

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function OngoingCampaigns({
  page,
  work,
  loading,
  error,
  onRetry,
  bare,
}: {
  page: EmailPage | null;
  work: WorkItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** the pane already says what this is — don't say it twice */
  bare?: boolean;
}) {
  const scheduled = (page?.sends ?? []).filter((s) => s.state !== 'sent');
  const sent = (page?.sends ?? []).filter((s) => s.state === 'sent');
  const best = Math.max(0.01, ...sent.map((s) => s.openRate));
  const waiting = work.filter((w) => w.status === 'needs-you');

  return (
    <section className="c-sec es-ongoing">
      {bare ? null : (
        <div className="es-box-head">
          <h2>Ongoing campaigns</h2>
          <span>{loading ? 'reading…' : `${scheduled.length + (page?.sequences.length ?? 0)} in flight`}</span>
        </div>
      )}

      {error ? (
        <div className="es-down">
          <p>Can’t reach the server — everything in this box is live data.</p>
          <button type="button" className="cta" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}

      {waiting.length ? (
        <div className="es-waiting">
          {waiting.map((w) => (
            <div className="es-wait-row" key={w.id}>
              <span className="brain-live" />
              <span className="es-wait-copy">{w.say ?? w.title}</span>
              <span className="es-pill s-draft">needs you</span>
            </div>
          ))}
        </div>
      ) : null}

      {scheduled.length ? (
        <div className="es-group">
          <div className="es-label">Queued</div>
          {scheduled.map((s) => (
            <div className="es-row" key={s.id}>
              <span className="es-row-t">{s.subject}</span>
              <span className="es-row-m">
                {s.when} · {s.audience.toLowerCase()}
              </span>
              <span className={`es-pill s-${s.state}`}>{s.state}</span>
            </div>
          ))}
        </div>
      ) : null}

      {page?.sequences.length ? (
        <div className="es-group">
          <div className="es-label">Running without you</div>
          {page.sequences.map((q) => (
            <div className="es-row" key={q.id}>
              <span className="es-row-t">{q.name}</span>
              <span className="es-row-m">
                {q.trigger} · {q.stat}
              </span>
              <span className={`es-pill s-${q.state}`}>{q.state}</span>
            </div>
          ))}
        </div>
      ) : null}

      {sent.length ? (
        <div className="es-group">
          <div className="es-label">Already out — opens, against your best</div>
          {sent.map((s) => (
            <div className="es-send" key={s.id}>
              <div className="es-send-top">
                <span className="es-row-t">{s.subject}</span>
                <span className="es-send-o">{pct(s.openRate)}</span>
              </div>
              <div className="es-bar">
                <span style={{ width: `${(s.openRate / best) * 100}%` }} />
              </div>
              <div className="es-row-m">
                {s.when} · {s.sent} sent · {s.replies} {s.replies === 1 ? 'reply' : 'replies'}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && !scheduled.length && !sent.length && !page?.sequences.length ? (
        <p className="es-empty">Nothing running yet. The first campaign is the one above.</p>
      ) : null}
    </section>
  );
}
