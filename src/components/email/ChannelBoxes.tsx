'use client';

import type { Health, Stat } from '@/lib/api/types';

/* ============================================================
   The three things under the brain.

   KPIs as their own boxes rather than one strip — a number that matters
   should be able to hold a corner of the screen. Then the pair the floor
   has: what Allya has learned about this channel, and whether the
   channel is in any state to be used at all.
   ============================================================ */

export function KpiBoxes({ stats }: { stats: Stat[] }) {
  if (!stats.length) return null;
  return (
    <div className="es-kpis">
      {stats.map((s) => (
        <div className="c-sec es-kpi" key={s.id}>
          <b>{s.value}</b>
          <span className="es-kpi-l">{s.label}</span>
          {s.delta ? <span className="es-kpi-d">{s.delta}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function KnowBox({ title, notes }: { title: string; notes: string[] }) {
  return (
    <section className="c-sec es-know">
      <div className="es-box-head">
        <h2>{title}</h2>
        <span>{notes.length ? `${notes.length} things` : 'nothing yet'}</span>
      </div>
      {notes.length ? (
        <ul className="es-know-list es-know-scroll">
          {notes.map((n) => (
            <li key={n}>
              <span className="es-know-dot" />
              {n}
            </li>
          ))}
        </ul>
      ) : (
        <p className="es-empty">Nothing learned yet — that starts with the first campaign.</p>
      )}
    </section>
  );
}

export function HealthBox({ health }: { health: Health | null }) {
  if (!health) return null;
  const w = health.warmup;
  return (
    <section className="c-sec es-health">
      <div className="es-box-head">
        <h2>{health.title}</h2>
        <span>{health.scores.length} readings</span>
      </div>
      {/* the readings outlast the box: it scrolls rather than pushing the
          page down every time a channel has more to say about itself */}
      <div className="es-health-scroll">
        <p className="es-health-blurb">{health.blurb}</p>

        <div className="es-scores">
          {health.scores.map((s) => (
            <div className={`es-score s-${s.state}`} key={s.id}>
              <span className="es-score-top">
                <span className="es-score-l">{s.label}</span>
                <span className="es-score-v">{s.value}</span>
              </span>
              <span className="es-score-n">{s.note}</span>
            </div>
          ))}
        </div>

        {w ? (
          <div className="es-warm">
            <div className="es-warm-top">
              <span>{w.label}</span>
              <span>
                {w.value} / {w.of}
              </span>
            </div>
            <div className="es-bar">
              <span style={{ width: `${Math.min(100, (w.value / Math.max(1, w.of)) * 100)}%` }} />
            </div>
            <div className="es-row-m">{w.note}</div>
          </div>
        ) : null}

        {health.updates.length ? (
          <ul className="es-know-list es-updates">
            {health.updates.map((u) => (
              <li key={u}>
                <span className="es-know-dot" />
                {u}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
