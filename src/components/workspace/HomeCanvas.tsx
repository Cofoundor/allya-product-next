'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BrainCanvas } from '@/components/BrainCanvas';
import { ApprovalCard } from './ApprovalCard';
import { DotPage } from './DotPage';
import { KnowledgeFeed } from './KnowledgeFeed';
import type { BrainHandle, OpenNodeInfo } from '@/lib/brain';
import type { Handoff } from '@/lib/handoff';
import { BRAIN_CROSS, BRAIN_NODES, DAY_PLAN, type WorkItem } from '@/lib/workspace-data';

/* The quiet canvas — one decision and your day, side by side, above the
   brain. Everything derives from the work list plus scripted context.
   This is what you see until you actually engage the composer. */
export function HomeCanvas({
  work,
  onb,
  deferred,
  onDefer,
  onOpenSheet,
  onAsk,
}: {
  work: WorkItem[];
  onb: Handoff | null;
  deferred: boolean;
  onDefer: (v: boolean) => void;
  onOpenSheet: (id: string) => void;
  onAsk?: (text: string) => void;
}) {
  const needs = work.filter((w) => w.status === 'needs-you');
  const brainRef = useRef<BrainHandle | null>(null);
  const [dot, setDot] = useState<OpenNodeInfo | null>(null);

  const closeDot = useCallback(() => {
    setDot(null);
    brainRef.current?.clearFocus();
  }, []);

  // the handoff arrives after mount — rename the hub when it does
  useEffect(() => {
    if (onb?.company) brainRef.current?.setHubLabel(onb.company);
  }, [onb]);

  const coName = onb?.company;
  const greet = coName
    ? `Morning. Here’s what I know about ${coName} — flag anything that’s off.`
    : 'Morning. Here’s what I know — flag anything that’s off.';

  return (
    <div className="canvas">
      <div className="canvas-inner">
        <p className="canvas-greet">{greet}</p>

        <BrainCanvas
          boxClassName="c-sec brain-box"
          onReady={(h) => {
            brainRef.current = h;
            if (onb?.company) h.setHubLabel(onb.company);
          }}
          options={{
            nodes: BRAIN_NODES,
            cross: BRAIN_CROSS,
            layout: 'web',
            revealed: true,
            thoughtEvery: 5,
            isLive: (n) => !!n.work && work.some((w) => w.id === n.work && w.status === 'needs-you'),
            pickTarget: (nodes) => {
              // bias toward nodes with live work
              const live = nodes.filter((n) => n.work && work.some((w) => w.id === n.work && w.status !== 'shipped'));
              const pool = live.length && Math.random() < 0.6 ? live : nodes.filter((n) => n.tier === 2);
              return pool[(Math.random() * pool.length) | 0];
            },
            // tapping a dot re-centres the brain and opens that node's page
            onOpenNode: setDot,
          }}
        >
          <div className="brain-head">
            <span className="brain-title">
              <span className="brain-live" /> The brain
            </span>
            <span className="brain-side">
              <span className="brain-sub">your company, as I understand it — touch it</span>
              <Link className="brain-onb" href="/onboarding">
                Onboarding →
              </Link>
            </span>
          </div>
        </BrainCanvas>

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
              1 thing waiting for tonight ·{' '}
              <button type="button" onClick={() => onDefer(false)}>
                actually, show me now
              </button>
            </p>
          </div>
        ) : (
          <div className="c-sec">
            <div className="group-label">Needs you</div>
            <p className="c-handled">
              Nothing right now. Agents are working; experts are checking. That&rsquo;s the whole point.
            </p>
          </div>
        )}

        <div className="c-row">
          <KnowledgeFeed company={coName ?? undefined} />

          <div className="c-sec">
            <div className="group-label">Today</div>
            {DAY_PLAN.map((d) => (
              <div className="day-row" key={d.what}>
                <span className="dr-time">{d.time}</span>
                <span className={`dr-what${d.quiet ? ' quiet' : ''}`}>{d.what}</span>
                {d.pill ? <span className="pill ready">{d.pill}</span> : null}
              </div>
            ))}
          </div>
        </div>

        <p className="canvas-hint">Click the bar below when you want to talk</p>
      </div>

      <DotPage
        info={dot}
        work={work}
        onClose={closeDot}
        onGoto={(id) => brainRef.current?.openNode(id)}
        onAsk={(label) => {
          closeDot();
          onAsk?.(`Tell me about ${label.toLowerCase()}`);
        }}
      />
    </div>
  );
}
