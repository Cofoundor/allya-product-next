'use client';

import { useState } from 'react';
import { PersonIcon } from '@/components/icons';
import type { Review } from '@/lib/api/types';

/* The approval surface's contents, rendered from whatever the server sends.
   The provenance trail is the load-bearing part: who touched this, in what
   order, and the fact that it stops at you. */

export function ReviewHead({ review }: { review: Review | null }) {
  if (!review) {
    return (
      <>
        <div className="avatar">A</div>
        <div>
          <div className="who">Allya</div>
          <div className="line sk-text">Pulling it up…</div>
        </div>
      </>
    );
  }
  const { head } = review;
  return (
    <>
      <div className={`avatar${head.human ? ' human' : ''}`}>{head.human ? <PersonIcon /> : head.avatar}</div>
      <div>
        <div className="who">
          {head.who}
          {head.role ? <span className="role"> · {head.role}</span> : null}
        </div>
        <div className="line">{head.line}</div>
      </div>
    </>
  );
}

export function ReviewBody({ review, error, onRetry }: { review: Review | null; error?: string; onRetry?: () => void }) {
  const [openDiff, setOpenDiff] = useState(false);

  if (error) {
    return (
      <p className="sheet-note">
        {error}{' '}
        {onRetry ? (
          <button type="button" className="link-btn" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </p>
    );
  }

  if (!review) {
    return (
      <div className="sk-list">
        {[0, 1, 2].map((i) => (
          <div className="sk-block" key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="trail">
        {review.trail.map((r) => (
          <div className={`trail-row${r.kind === 'you' ? ' now' : ''}`} key={r.text}>
            <span className={`t-dot ${r.kind}`}>{r.kind === 'expert' ? <PersonIcon /> : null}</span>
            <span className="t-txt">{r.text}</span>
            {r.kind === 'expert' && review.diff.length ? (
              <button type="button" className="trail-toggle" onClick={() => setOpenDiff((v) => !v)}>
                {openDiff ? 'hide the edits' : 'see the edits'}
              </button>
            ) : null}
            {r.time ? <span className="t-time">{r.time}</span> : null}
          </div>
        ))}
        {openDiff && review.diff.length ? (
          <div className="trail-diff">
            {review.diff.map((d) => (
              <div className="d-pair" key={d.old}>
                <div className="d-old">{d.old}</div>
                <div className="d-new">{d.new}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {review.drafts.map((d) => (
        <div className="draft" key={d.kicker}>
          <div className="kicker">{d.kicker}</div>
          <h4>{d.title}</h4>
          <p>{d.body}</p>
          {d.tags.length ? (
            <div className="tags">
              {d.tags.map((t) => (
                <span className="tag" key={t}>
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}

      {review.note ? <p className="undo-note">{review.note}</p> : null}
    </>
  );
}
