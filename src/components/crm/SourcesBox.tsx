'use client';

import type { Progress, Source } from '@/lib/api/types';

/* ============================================================
   Where the people come from.

   The channel studio's health box answers "will any of this arrive?".
   This is the same question one step earlier: is the book still being
   fed, and by what. A source that stopped bringing people is the reason
   a funnel goes quiet, and it should be readable in the same glance.
   ============================================================ */

export function SourcesBox({
  sources,
  progress,
}: {
  sources: Source[];
  progress: Progress | null;
}) {
  const live = sources.filter((s) => s.state === 'connected');
  return (
    <section className="c-sec es-health">
      <div className="es-box-head">
        <h2>Where they come from</h2>
        <span>
          {live.length} of {sources.length} feeding
        </span>
      </div>
      <div className="es-health-scroll">
        <p className="es-health-blurb">
          Every send, reply, payment and cancellation lands on the person it happened to — not just
          on the campaign that caused it.
        </p>

        <div className="es-scores">
          {sources.map((s) => (
            <div className={`es-score s-${s.state === 'connected' ? 'good' : s.state === 'error' ? 'bad' : 'watch'}`} key={s.id}>
              <span className="es-score-top">
                <span className="es-score-l">{s.label}</span>
                <span className="es-score-v">
                  {s.count ? `${s.count}` : s.state === 'connected' ? '—' : 'not on'}
                </span>
              </span>
              <span className="es-score-n">
                {s.blurb}
                {s.lastSync ? ` · last ${s.lastSync}` : null}
              </span>
            </div>
          ))}
        </div>

        {progress ? (
          <div className="es-warm">
            <div className="es-warm-top">
              <span>{progress.label}</span>
              <span>
                {progress.value} / {progress.of}
              </span>
            </div>
            <span className="es-bar">
              <span style={{ width: `${(progress.value / Math.max(1, progress.of)) * 100}%` }} />
            </span>
            <p className="es-score-n">{progress.note}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
