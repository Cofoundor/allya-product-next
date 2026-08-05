'use client';

import { GROUPS, branchTints } from '@/lib/brain';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import type { EmailPage, Review, Send, WorkList } from '@/lib/api/types';
import { BrandCrumbs } from '@/components/workspace/Crumbs';

/* ============================================================
   DESIGN MOCK — email marketing, one job inside the marketing floor.

   A floor tells you the shape of a service. This is the depth a founder
   actually works at: the list, what went out and what it did, and the
   things that run without you. Everything is a real object with a real
   number, because "email marketing" with no open rate is a brochure.
   ============================================================ */

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function EmailDirection() {
  const page = useResource<EmailPage>(paths.direction('email'));
  // campaigns are their own collection now — this throwaway mock follows
  const sendsRes = useResource<Send[]>(paths.campaigns('email'));
  const sends = sendsRes.data ?? [];
  const work = useResource<WorkList>(paths.work('marketing'));
  const d = page.data;

  // email is the fourth direction on the marketing floor — it wears that tint
  const accent = branchTints(GROUPS.marketing).b4;
  const awaiting = d?.awaiting ? work.data?.items.find((w) => w.id === d.awaiting) : undefined;
  const best = Math.max(0.01, ...(sends).map((s) => s.openRate));

  if (page.error) {
    return (
      <div className="mock em">
        <div className="em-down">
          <p>Can’t reach the server — this page is all live data.</p>
          <button type="button" className="cta" onClick={page.reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mock em" style={{ ['--accent' as string]: accent } as React.CSSProperties}>
      <header className="mock-bar">
        <BrandCrumbs
          trail={[
            { label: 'Company', href: '/' },
            { label: 'Marketing', href: '/marketing' },
            { label: d?.label ?? 'Email' },
          ]}
        />
        <span className="mock-flag">design mock</span>
      </header>

      <main className="em-body">
        <div className="em-head">
          <h1>{d?.label ?? 'Email'}</h1>
          <p>{d?.blurb ?? ' '}</p>
        </div>

        {/* the numbers that decide everything below */}
        <div className="em-stats">
          {(d?.stats ?? []).map((s) => (
            <div className="em-stat" key={s.id}>
              <b>{s.value}</b>
              <span className="l">{s.label}</span>
              {s.delta ? <span className="d">{s.delta}</span> : null}
            </div>
          ))}
        </div>

        {/* the one thing that stops until you look at it */}
        {awaiting ? (
          <section className="em-await">
            <div className="em-await-tag">
              <span className="brain-live" /> Waiting on you
            </div>
            <h2>{sends.find((s) => s.state === 'scheduled')?.subject ?? awaiting.title}</h2>
            <p>{awaiting.say}</p>
            <div className="em-await-act">
              <button type="button" className="cta">
                Read it
              </button>
              <span className="hint">
                goes {sends.find((s) => s.state === 'scheduled')?.when ?? 'when you say'} · holds 10 min after you approve
              </span>
            </div>
          </section>
        ) : null}

        <div className="em-cols">
          <section className="em-panel">
            <div className="em-panel-head">
              <h3>What you’ve sent</h3>
              <span>opens, against your best</span>
            </div>
            {(sends)
              .filter((s) => s.state === 'sent')
              .map((s) => (
                <div className="em-send" key={s.id}>
                  <div className="em-send-top">
                    <span className="s">{s.subject}</span>
                    <span className="o">{pct(s.openRate)}</span>
                  </div>
                  <div className="em-bar">
                    <span style={{ width: `${(s.openRate / best) * 100}%` }} />
                  </div>
                  <div className="em-send-meta">
                    {s.when} · {s.sent} sent · {s.replies} {s.replies === 1 ? 'reply' : 'replies'}
                  </div>
                </div>
              ))}
          </section>

          <div className="em-side">
            {d?.progress ? (
              <section className="em-panel">
                <div className="em-panel-head">
                  <h3>{d.progress.label}</h3>
                </div>
                <div className="em-prog">
                  <span style={{ width: `${(d.progress.value / d.progress.of) * 100}%` }} />
                </div>
                <div className="em-prog-meta">
                  day {d.progress.value} of {d.progress.of} · {d.progress.note}
                </div>
              </section>
            ) : null}

            <section className="em-panel">
              <div className="em-panel-head">
                <h3>Running without you</h3>
                <span>{(d?.sequences ?? []).filter((s) => s.state === 'live').length} live</span>
              </div>
              {(d?.sequences ?? []).map((s) => (
                <div className={`em-seq s-${s.state}`} key={s.id}>
                  <span className="em-seq-dot" />
                  <div className="em-seq-copy">
                    <div className="n">
                      {s.name} <span className="t">· {s.trigger}</span>
                    </div>
                    <div className="m">
                      {s.audience} · {s.stat}
                    </div>
                  </div>
                  <span className={`em-seq-state s-${s.state}`}>{s.state}</span>
                </div>
              ))}
            </section>

            <section className="em-panel em-notes">
              <div className="em-panel-head">
                <h3>What I know about your email</h3>
              </div>
              {(d?.notes ?? []).map((n) => (
                <p key={n}>{n}</p>
              ))}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
