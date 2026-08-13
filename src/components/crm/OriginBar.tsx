'use client';

import type { OriginStat } from '@/lib/api/types';

/* ============================================================
   Where the leads actually come from.

   A count per channel is not the answer — the door that brings the most
   people is routinely not the door that brings the ones who pay. So each
   one shows both: how many came through, and how many of those got
   anywhere. Picking one narrows every funnel on the page to that door,
   which is the only way to see the difference.
   ============================================================ */

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function OriginBar({
  origins,
  picked,
  onPick,
}: {
  origins: OriginStat[];
  picked: string | null;
  onPick: (id: string | null) => void;
}) {
  if (!origins.length) return null;
  const best = Math.max(...origins.map((o) => o.rate), 0.01);

  return (
    <div className="pl-origins">
      <div className="pl-origins-head">
        <h3>Where they came from</h3>
        <span>ranked by how many got anywhere, not how many arrived</span>
      </div>
      <div className="pl-origin-row" role="group" aria-label="Filter by where they came from">
        <button
          type="button"
          className={`pl-origin${picked ? '' : ' is-on'}`}
          onClick={() => onPick(null)}
        >
          <span className="pl-origin-t">Every door</span>
          <span className="pl-origin-n">{origins.reduce((n, o) => n + o.count, 0)}</span>
        </button>
        {origins.map((o) => (
          <button
            type="button"
            key={o.id}
            className={`pl-origin${picked === o.id ? ' is-on' : ''}`}
            aria-pressed={picked === o.id}
            title={o.said}
            onClick={() => onPick(picked === o.id ? null : o.id)}
          >
            <span className="pl-origin-t">{o.said}</span>
            <span className="pl-origin-n">{o.count}</span>
            {/* the bar is the conversion rate, not the volume — otherwise
                the biggest channel always looks like the best one */}
            <span className="pl-origin-bar">
              <span style={{ width: `${(o.rate / best) * 100}%` }} />
            </span>
            <span className="pl-origin-r">
              {pct(o.rate)} worth a call
              {o.paying ? ` · ${o.paying} paying` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
