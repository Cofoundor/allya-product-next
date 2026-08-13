'use client';

import { useMemo } from 'react';
import type { Pipeline } from '@/lib/api/types';

/* ============================================================
   The map: a pipeline, drawn.

   Same component for all five, because they are the same object. The
   geometry is the only thing that changes, and it changes because the
   question changes:

     funnel  — how many people are at each stage, narrowing as it goes
     ladder  — the same, read upward, because a candidate climbs
     radar   — distance from the middle is how long since you spoke

   SVG rather than canvas: the bands are geometric, they don't animate,
   and a <button> per band gives keyboard and screen readers the same
   access to the shape that a pointer has.
   ============================================================ */

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** "people" → "person", "deals" → "deal". Only ever applied to the count
    nouns the backend sends, which is why it can be this small. */
const singular = (n: string) => (n === 'people' ? 'person' : n.replace(/s$/, ''));

/** drop the leading capital so a title reads mid-sentence, without
    flattening the proper nouns inside it */
const uncap = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

export function PipelineCanvas({
  pipeline,
  picked,
  onPick,
  loading,
  through,
}: {
  pipeline: Pipeline | null;
  /** the stage currently narrowing the list, if any */
  picked: string | null;
  onPick: (stageId: string | null) => void;
  loading?: boolean;
  /** the one door this funnel is being read through, when narrowed */
  through?: string;
}) {
  const bands = useMemo(() => {
    if (!pipeline) return [];
    const stages = pipeline.geometry === 'ladder' ? [...pipeline.stages].reverse() : pipeline.stages;
    const counts = stages.map((s) => pipeline.counts[s.id] ?? 0);
    const max = Math.max(1, ...counts);
    return stages.map((s, i) => ({
      stage: s,
      count: counts[i],
      // square-rooted so an empty stage still has a shape to click and a
      // huge one doesn't flatten everything under it
      rel: Math.sqrt(counts[i] / max),
    }));
  }, [pipeline]);

  if (!pipeline) {
    return (
      <div className="pl-map is-loading" aria-hidden>
        <div className="pl-map-sk sk-text" />
      </div>
    );
  }

  const isRadar = pipeline.geometry === 'radar';
  const total = Object.values(pipeline.counts).reduce((a, b) => a + b, 0);

  return (
    <div className={`pl-map g-${pipeline.geometry}`}>
      <div className="pl-map-head">
        <h2>
          {pipeline.label}
          {/* uncapitalised, not lowercased — "SurferSearcher" is a name */}
          {through ? <span className="pl-through"> through {uncap(through)}</span> : null}
        </h2>
        <span>
          {loading ? 'reading the book…' : null}
          {!loading && pipeline.value != null ? `${money(pipeline.value)} still open` : null}
          {!loading && pipeline.value == null ? `${total} ${pipeline.countNoun}` : null}
        </span>
      </div>

      {isRadar ? (
        <Radar bands={bands} picked={picked} onPick={onPick} />
      ) : (
        <div className="pl-bands">
          {bands.map(({ stage, count, rel }) => {
            const on = picked === stage.id;
            return (
              <button
                type="button"
                key={stage.id}
                className={`pl-band st-${stage.kind}${on ? ' is-on' : ''}${count ? '' : ' is-empty'}`}
                aria-pressed={on}
                // said outright, because the count is the point and a
                // tooltip is not a label
                aria-label={`${stage.label}, ${count} ${count === 1 ? singular(pipeline.countNoun) : pipeline.countNoun}`}
                onClick={() => onPick(on ? null : stage.id)}
                title={stage.note || undefined}
              >
                <span className="pl-band-fill" style={{ width: `${12 + rel * 88}%` }} />
                <span className="pl-band-l">{stage.label}</span>
                <span className="pl-band-n">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className="pl-map-cap">
        {isRadar
          ? 'The middle is someone you spoke to this week. The edge is someone going cold.'
          : pipeline.geometry === 'ladder'
            ? 'One rung per stage, read upward. The top rung is your call.'
            : `Each band is a stage. The width of a band is how many ${pipeline.countNoun} are in it.`}
        {picked ? ' Tap it again to see everyone.' : ' Tap one to narrow the list.'}
      </p>
    </div>
  );
}

/* Rings rather than bands: a press list isn't a funnel — nobody moves
   "down" it — so the question is how long since you spoke, not how far
   through they are. */
function Radar({
  bands,
  picked,
  onPick,
}: {
  bands: { stage: { id: string; label: string; kind: string; note: string }; count: number; rel: number }[];
  picked: string | null;
  onPick: (id: string | null) => void;
}) {
  const n = Math.max(1, bands.length);
  return (
    <div className="pl-radar">
      <svg viewBox="0 0 240 200" role="presentation" className="pl-radar-svg">
        {[0.28, 0.52, 0.78].map((r) => (
          <ellipse key={r} cx="120" cy="100" rx={100 * r} ry={82 * r} className="pl-ring" />
        ))}
        <text x="120" y="96" className="pl-ring-t">
          this week
        </text>
        <text x="120" y="14" className="pl-ring-t">
          gone cold
        </text>
      </svg>
      <div className="pl-radar-dots">
        {bands.map(({ stage, count, rel }, i) => {
          const on = picked === stage.id;
          // stage index is how far out; the angle only spreads them apart
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const rad = 0.1 + (i / Math.max(1, n - 1)) * 0.4;
          return (
            <button
              type="button"
              key={stage.id}
              className={`pl-dot${on ? ' is-on' : ''}${count ? '' : ' is-empty'}`}
              aria-pressed={on}
              aria-label={`${stage.label}, ${count}`}
              onClick={() => onPick(on ? null : stage.id)}
              style={{
                left: `${(0.5 + Math.cos(a) * rad) * 100}%`,
                top: `${(0.5 + Math.sin(a) * rad) * 100}%`,
                ['--size' as string]: `${10 + rel * 26}px`,
              }}
            >
              <span className="pl-dot-o" />
              <span className="pl-dot-l">
                {stage.label} <b>{count}</b>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
