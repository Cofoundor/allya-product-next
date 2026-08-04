'use client';

import type { ReactNode } from 'react';
import { TickIcon } from '@/components/icons';
import { ApprovalCard } from './ApprovalCard';
import type { WorkItem } from '@/lib/api/types';

/* The work panel — data-driven, and the visible proof this is a tool.
   Needs you / Running / Shipped today, each row carrying an origin pill:
   the honest 85/15 seam between agents and real experts.

   The three groups never scroll each other. The panel fits the viewport and
   each group takes its own scrollbar, so a long Shipped list can't push the
   one thing waiting on you off the bottom of the screen. */

function Group({
  title,
  count,
  wide,
  children,
}: {
  title: string;
  count: number;
  /** the lime-lit group gets first call on the height */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`work-group${wide ? ' needs' : ''}`}>
      <div className="group-label">
        {title} <span className="count">{count}</span>
      </div>
      <div className="work-scroll">{children}</div>
    </section>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <aside className="pane-work" aria-label="Work in motion">
      <div className="work-head">
        <h2>Work</h2>
        <span className="split-note">
          <b>85%</b> agents · <b>15%</b> experts
        </span>
      </div>
      {children}
    </aside>
  );
}

export function WorkPane({
  work,
  loading,
  error,
  onRetry,
  onOpenSheet,
  onUndo,
}: {
  work: WorkItem[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onOpenSheet: (id: string) => void;
  onUndo: (id: string) => void;
}) {
  const needs = work.filter((w) => w.status === 'needs-you');
  const running = work.filter((w) => w.status === 'running');
  const shipped = work.filter((w) => w.status === 'shipped');

  if (error) {
    return (
      <Shell>
        <div className="work-row">
          <div className="w-copy">
            <div className="t">{error}</div>
            <div className="s">
              Nothing is lost — I just can&rsquo;t reach the server.{' '}
              {onRetry ? (
                <button type="button" className="link-btn" onClick={onRetry}>
                  Try again
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (loading && !work.length) {
    return (
      <Shell>
        <div className="sk-list">
          {[0, 1, 2, 3, 4].map((i) => (
            <div className="sk-row" key={i} />
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="work-cols">
        <Group title="Needs you" count={needs.length} wide>
          {needs.length === 0 ? (
            <div className="work-row">
              <div className="w-copy">
                <div className="s">Nothing waiting on you. Enjoy it.</div>
              </div>
            </div>
          ) : null}
          {needs.map((w) => (
            <ApprovalCard
              key={w.id}
              item={w}
              ctaLabel="Review →"
              onOpen={() => onOpenSheet(w.id)}
              after={<span className="hint">nothing ships until you approve</span>}
            />
          ))}
        </Group>

        <Group title="Running" count={running.length}>
          {running.map((w) => (
            <div className="work-row" key={w.id}>
              <span className="spinner" />
              <div className="w-copy">
                <div className="t">{w.title}</div>
                <div className="s">{w.meta}</div>
              </div>
              <span className={`pill${w.origin === 'expert' ? ' expert' : ''}`}>{w.origin}</span>
            </div>
          ))}
        </Group>

        <Group title="Shipped today" count={shipped.length}>
          {shipped.map((w) => (
            <div className="work-row shipped rise-in" key={w.id}>
              <span className="tick">
                <TickIcon />
              </span>
              <div className="w-copy">
                <div className="t">{w.title}</div>
                <div className="s">
                  {w.meta}
                  {w.undoable ? (
                    <>
                      {' · '}
                      <button type="button" className="row-undo" onClick={() => onUndo(w.id)}>
                        undo
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <span className="pill">{w.origin}</span>
            </div>
          ))}
        </Group>
      </div>
    </Shell>
  );
}
