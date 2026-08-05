'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GROUPS } from '@/lib/brain';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import type { Instrument, Surface, SurfaceSummary, WorkList } from '@/lib/api/types';
import { BrandCrumbs } from '@/components/workspace/Crumbs';
import { InstrumentCanvas } from './InstrumentCanvas';

/* ============================================================
   DESIGN MOCK — option 1, "the brain becomes the instrument".

   The graph isn't a picture of the work any more, it's the work: where
   a thing sits is the information. Underneath sits the one thing a
   graph is bad at — an exact, readable list.

   Throwaway route. The real floors at /[service] are untouched.
   ============================================================ */

const ORDER: Record<string, number> = { 'needs-you': 0, running: 1, scheduled: 2, active: 3, shipped: 4, idle: 5 };

export default function MockFloor({ surfaceId }: { surfaceId: string }) {
  const surface = useResource<Surface>(paths.surface(surfaceId));
  const inst = useResource<Instrument>(paths.instrument(surfaceId));
  const work = useResource<WorkList>(paths.work(surfaceId));
  const all = useResource<SurfaceSummary[]>(paths.surfaces());
  const [picked, setPicked] = useState<string | null>(null);

  const accent = GROUPS[surfaceId] ?? '#91d45f';
  const needs = (work.data?.items ?? []).filter((w) => w.status === 'needs-you');
  const items = [...(inst.data?.items ?? [])].sort(
    (a, b) => (ORDER[a.state] ?? 9) - (ORDER[b.state] ?? 9) || b.value - a.value,
  );

  return (
    <div className="mock" style={{ ['--accent' as string]: accent } as React.CSSProperties}>
      <header className="mock-bar">
        <BrandCrumbs
          trail={[{ label: 'Company', href: '/' }, { label: surface.data?.label ?? '…' }]}
        />
        <nav className="mock-tabs">
          {(all.data ?? [])
            .filter((s) => s.id !== 'workspace')
            .map((s) => (
              <Link
                key={s.id}
                href={`/mock/${s.id}`}
                className={s.id === surfaceId ? 'is-here' : undefined}
                style={{ ['--tab' as string]: GROUPS[s.id] } as React.CSSProperties}
              >
                {s.label}
              </Link>
            ))}
        </nav>
        <span className="mock-flag">design mock</span>
        <Link className="kbd" href={`/${surfaceId}`}>
          the real floor →
        </Link>
      </header>

      <main className="mock-body">
        <section className="mock-stage">
          <div className="mock-head">
            <h1>{inst.data?.title ?? surface.data?.label ?? '…'}</h1>
            <p>{inst.data?.caption ?? ' '}</p>
          </div>

          {inst.error ? (
            <div className="inst-box inst-down">
              <p>No instrument for this floor — is the API running?</p>
            </div>
          ) : inst.data ? (
            <InstrumentCanvas inst={inst.data} accent={accent} picked={picked} onPick={setPicked} />
          ) : (
            <div className="inst-box inst-down">
              <p>Reading the floor…</p>
            </div>
          )}

          {needs.length ? (
            <div className="mock-needs">
              <span className="brain-live" />
              <p>{needs[0].say ?? needs[0].title}</p>
              <button type="button" className="cta">
                Review
              </button>
            </div>
          ) : null}
        </section>

        <aside className="mock-list" aria-label="The same thing, exactly">
          <div className="mock-list-head">
            <h2>Every one of them</h2>
            <span>{inst.data?.unit || 'in order of who needs you'}</span>
          </div>
          {items.map((it) => (
            <button
              type="button"
              key={it.id}
              className={`mock-row${picked === it.id ? ' is-picked' : ''}`}
              onMouseEnter={() => setPicked(it.id)}
              onFocus={() => setPicked(it.id)}
              onClick={() => setPicked(it.id)}
            >
              <span className={`mock-dot s-${it.state}`} />
              <span className="mock-copy">
                <span className="t">{it.label}</span>
                <span className="m">{it.meta}</span>
              </span>
              {it.state === 'needs-you' ? <span className="mock-pill">you</span> : null}
            </button>
          ))}
          {!items.length && !inst.error ? <p className="mock-empty">…</p> : null}
        </aside>
      </main>
    </div>
  );
}
