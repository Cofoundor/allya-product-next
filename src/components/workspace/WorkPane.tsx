'use client';

import { TickIcon } from '@/components/icons';
import { ApprovalCard } from './ApprovalCard';
import type { WorkItem } from '@/lib/api/types';

/* The work panel — data-driven, and the visible proof this is a tool.
   Needs you / Running / Shipped today, each row carrying an origin pill:
   the honest 85/15 seam between agents and real experts. */
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
      <aside className="pane-work" aria-label="Work in motion">
        <div className="work-head">
          <h2>Work</h2>
        </div>
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
      </aside>
    );
  }

  if (loading && !work.length) {
    return (
      <aside className="pane-work" aria-label="Work in motion">
        <div className="work-head">
          <h2>Work</h2>
        </div>
        <div className="sk-list">
          {[0, 1, 2, 3, 4].map((i) => (
            <div className="sk-row" key={i} />
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="pane-work" aria-label="Work in motion">
      <div className="work-head">
        <h2>Work</h2>
        <span className="split-note">
          <b>85%</b> agents · <b>15%</b> experts
        </span>
      </div>

      <div className="group-label">
        Needs you <span className="count">{needs.length}</span>
      </div>
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

      <div className="group-label">
        Running <span className="count">{running.length}</span>
      </div>
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

      <div className="group-label">
        Shipped today <span className="count">{shipped.length}</span>
      </div>
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
    </aside>
  );
}
