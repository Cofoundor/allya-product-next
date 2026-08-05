'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BrainCanvas } from '@/components/BrainCanvas';
import { ApprovalCard } from '@/components/workspace/ApprovalCard';
import { DotPage } from '@/components/workspace/DotPage';
import { KnowledgeFeed } from '@/components/workspace/KnowledgeFeed';
import { useTimers } from '@/lib/hooks';
import { prefersReducedMotion } from '@/lib/spring';
import { GROUPS, branchTints, type BrainHandle, type NodeSpec, type OpenNodeInfo } from '@/lib/brain';
import { isDirection, paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import type { BrainGraph, Schedule, Surface, WorkItem } from '@/lib/api/types';
import { takeLaunch } from './launch';

/* The quiet canvas: greeting, the brain, the one decision, and two boxes.
   The same component serves the company ring and a service's spray — the
   layout, the nodes and every word come from the surface payload. */

export function SurfaceCanvas({
  surfaceId,
  surface,
  brain,
  brainError,
  onRetryBrain,
  work,
  deferred,
  onDefer,
  onOpenSheet,
  onAsk,
  onLaunch,
  onBrainReady,
}: {
  surfaceId: string;
  surface: Surface | null;
  brain: BrainGraph | null;
  brainError?: boolean;
  onRetryBrain?: () => void;
  work: WorkItem[];
  deferred: boolean;
  onDefer: (v: boolean) => void;
  onOpenSheet: (id: string) => void;
  onAsk: (text: string) => void;
  onLaunch: (nodeId: string, service: string) => void;
  onBrainReady: (h: BrainHandle) => void;
}) {
  const needs = work.filter((w) => w.status === 'needs-you');
  const brainRef = useRef<BrainHandle | null>(null);
  const [dot, setDot] = useState<OpenNodeInfo | null>(null);
  const [grown, setGrown] = useState(false);
  const { after, clearAll } = useTimers();
  const introFor = useRef<BrainHandle | null>(null);

  const schedule = useResource<Schedule>(surfaceId ? paths.schedule(surfaceId) : null);

  const closeDot = useCallback(() => {
    setDot(null);
    brainRef.current?.clearFocus();
  }, []);

  /* Some directions are rooms, not panels. The API doesn't know that yet —
     it has no `surface` on a branch — so the one that has a page of its own
     is marked here, and from then on it behaves like every other place you
     can fly into: tap the dot, the camera dives, the route changes. */
  const launchable = useCallback(
    (ns: NodeSpec[]) => ns.map((n) => (isDirection(n.id) ? { ...n, surface: n.id } : n)),
    [],
  );

  const branches = brain ? brain.nodes.filter((n) => n.parent === brain.anchorId && n.tier === 2) : [];
  const spray = brain?.layout === 'spray';
  // the floor's own eight tints — the rail and the canvas must agree
  const tints = useMemo(() => {
    const hue = brain && spray ? GROUPS[brain.anchorId] : null;
    return hue ? branchTints(hue) : {};
  }, [brain, spray]);
  // a thought should land on a tip, so it travels the whole path to get there
  const tips = useMemo(() => {
    const parents = new Set((brain?.nodes ?? []).map((n) => n.parent).filter(Boolean));
    return new Set((brain?.nodes ?? []).filter((n) => n.parent && !parents.has(n.id)).map((n) => n.id));
  }, [brain]);

  /* ---- the intro. If we flew here from another brain, pick that flight up
     mid-air; otherwise settle straight into frame. Either way the tree grows
     outward from the anchor. Every beat is a timer, never rAF — a throttled
     tab would otherwise strand the graph half-grown. ---- */
  const runIntro = useCallback(
    (h: BrainHandle, graph: BrainGraph) => {
      if (introFor.current === h) return;
      introFor.current = h;
      clearAll();

      // the company brain arrives whole — but if we flew back into it, land
      // the same way we left: pushed in on the hub, coasting out to frame
      if (graph.layout !== 'spray') {
        setGrown(true);
        if (takeLaunch(surfaceId) && !prefersReducedMotion()) h.arriveInto(graph.anchorId);
        return;
      }

      const bIds = graph.nodes.filter((n) => n.parent === graph.anchorId && n.tier === 2).map((n) => n.id);
      const lIds = graph.nodes.filter((n) => n.tier === 3).map((n) => n.id);

      if (prefersReducedMotion()) {
        [...bIds, ...lIds].forEach((id) => h.reveal(id));
        h.frame(null, 1, true);
        setGrown(true);
        return;
      }

      h.setThoughts(false);
      const flew = takeLaunch(surfaceId);
      if (flew) h.arriveInto(graph.anchorId);
      else h.frame(null, 1, true);

      // the directions open first, one at a time, out of the anchor
      const start = flew ? 220 : 420;
      bIds.forEach((id, i) => {
        after(start + i * 95, () => {
          h.reveal(id);
          h.pulse(id);
        });
      });

      const leafAt = start + bIds.length * 95 + 140;
      after(leafAt, () => setGrown(true));
      lIds.forEach((id, i) => {
        after(leafAt + i * 32, () => {
          h.reveal(id);
          if (i % 3 === 0) h.pulse(id);
        });
      });
      after(leafAt + lIds.length * 32 + 400, () => h.setThoughts(true));
    },
    [after, clearAll, surfaceId],
  );

  const greet = surface?.greeting ?? '';

  return (
    <div className="canvas">
      <div className={`canvas-inner${spray ? ' svc-inner' : ''}`}>
        <p className={`canvas-greet${greet ? '' : ' sk-text'}`}>{greet || ' '}</p>

        {brainError ? (
          <div className={`c-sec brain-box${spray ? ' brain-tall' : ''} brain-down`}>
            <p className="brain-down-copy">
              The brain is offline — I can&rsquo;t reach the server.
              <button type="button" className="link-btn" onClick={onRetryBrain}>
                Try again
              </button>
            </p>
          </div>
        ) : !brain || !surface ? (
          <div className={`c-sec brain-box${spray ? ' brain-tall' : ''} brain-waking`}>
            <span className="brain-waking-copy">waking the brain up…</span>
          </div>
        ) : (
          <BrainCanvas
            key={brain.surfaceId}
            boxClassName={`c-sec brain-box${spray ? ' brain-tall' : ''}`}
            onReady={(h) => {
              brainRef.current = h;
              onBrainReady(h);
              runIntro(h, brain);
            }}
            options={{
              nodes: launchable(brain.nodes as NodeSpec[]),
              cross: brain.links,
              layout: brain.layout,
              anchorId: brain.anchorId,
              revealed: true,
              thoughtEvery: spray ? 3.4 : 5,
              leafSpread: spray ? 0.15 : undefined,
              leafReach: spray ? 0.94 : undefined,
              // the floor's hue: thoughts along the edges, and eight branch
              // tints spun out of it rather than the shared rainbow
              accent: spray ? GROUPS[brain.anchorId] : undefined,
              groupColors: spray ? tints : undefined,
              radii: spray ? { 0: 5.6, 1: 8.2, 2: 4.6, 3: 2.9 } : undefined,
              isLive: (n) =>
                work.some(
                  (w) =>
                    w.status === 'needs-you' &&
                    (w.id === n.work || (!!n.surface && w.surfaceId === n.surface)),
                ),
              pickTarget: (ns) => {
                const live = ns.filter((n) => n.work && work.some((w) => w.id === n.work && w.status !== 'shipped'));
                const pool = live.length && Math.random() < 0.55 ? live : ns.filter((n) => tips.has(n.id));
                return pool[(Math.random() * pool.length) | 0];
              },
              onOpenNode: setDot,
              onLaunch,
            }}
          >
            <div className="brain-head">
              <span className="brain-title">
                <span className="brain-live" /> {surface.brain.title}
              </span>
              <span className="brain-side">
                <span className="brain-sub">{surface.brain.subtitle}</span>
                {surface.brain.backHref ? (
                  <Link className="brain-onb" href={surface.brain.backHref}>
                    {surface.brain.backLabel}
                  </Link>
                ) : null}
              </span>
            </div>
          </BrainCanvas>
        )}

        {branches.length ? (
          <div className={`svc-dirs${grown ? '' : ' is-growing'}`} aria-label="Directions">
            {branches.map((d) => (
              <button
                type="button"
                className="svc-dir"
                key={d.id}
                disabled={!grown}
                style={{ ['--dir' as string]: tints[d.group] ?? GROUPS[d.group] }}
                // a direction with a room of its own is flown into from the
                // rail too — the rail and the dot must never disagree
                onClick={() => (isDirection(d.id) ? onLaunch(d.id, d.id) : brainRef.current?.openNode(d.id))}
              >
                <span className="svc-dir-dot" />
                {d.label}
              </button>
            ))}
          </div>
        ) : null}

        {needs.length && !deferred ? (
          <div className="c-sec accent">
            <div className="group-label">Needs you</div>
            <ApprovalCard
              item={needs[0]}
              ctaLabel="Review now"
              onOpen={() => onOpenSheet(needs[0].id)}
              after={
                <button
                  type="button"
                  className="c-later"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDefer(true);
                  }}
                >
                  Later today
                </button>
              }
            />
          </div>
        ) : needs.length && deferred ? (
          <div className="c-sec accent">
            <div className="group-label">Needs you</div>
            <p className="c-waiting">
              {needs.length} thing{needs.length === 1 ? '' : 's'} waiting for tonight ·{' '}
              <button type="button" onClick={() => onDefer(false)}>
                actually, show me now
              </button>
            </p>
          </div>
        ) : (
          <div className="c-sec">
            <div className="group-label">Needs you</div>
            <p className="c-handled">{surface?.emptyNeeds ?? ' '}</p>
          </div>
        )}

        <div className="c-row">
          <KnowledgeFeed surfaceId={surfaceId} title={surface?.knowledgeTitle ?? 'What I know'} />

          <div className="c-sec">
            <div className="group-label">{surface?.scheduleTitle ?? 'Today'}</div>
            {schedule.loading ? (
              <div className="sk-list">
                {[0, 1, 2].map((i) => (
                  <div className="sk-line" key={i} />
                ))}
              </div>
            ) : schedule.error ? (
              <p className="kf-empty">
                Couldn&rsquo;t load this.{' '}
                <button type="button" className="link-btn" onClick={schedule.reload}>
                  Try again
                </button>
              </p>
            ) : schedule.data?.entries.length ? (
              schedule.data.entries.map((d) => (
                <div className="day-row" key={d.id}>
                  <span className="dr-time">{d.when}</span>
                  <span className={`dr-what${d.quiet ? ' quiet' : ''}`}>{d.what}</span>
                  {d.pill ? <span className="pill ready">{d.pill}</span> : null}
                </div>
              ))
            ) : (
              <p className="kf-empty">Nothing scheduled.</p>
            )}
          </div>
        </div>

        <p className="canvas-hint">{surface?.hint ?? ' '}</p>
      </div>

      <DotPage
        info={dot}
        work={work}
        deptCopy={surface?.nodeCopy ?? {}}
        branchWord={spray ? 'direction' : undefined}
        deepLink={(n) => {
          if (spray && n.id === brain?.anchorId && surface?.brain.backHref) {
            return {
              href: surface.brain.backHref,
              label: 'Back to the whole company',
              note: 'this floor is one branch of it — the cord below is the same brain',
            };
          }
          // a direction with a page of its own never gets here — tapping it
          // flies, the same as tapping a service on the company brain
          return null;
        }}
        onClose={closeDot}
        onGoto={(id) => brainRef.current?.openNode(id)}
        onAsk={(label) => {
          closeDot();
          onAsk(`Tell me about ${label.toLowerCase()}`);
        }}
      />
    </div>
  );
}
