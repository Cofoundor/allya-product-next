'use client';

import { useState } from 'react';
import type { DraftCampaign, Nouns } from '@/lib/api/types';

/* ============================================================
   The campaign, ready.

   Written by the channel out of the five answers — the founder's own
   sentences carry every claim, so the only thing on offer here is which
   line goes in the subject. Queueing it is a real POST: the campaign
   comes back with an id and joins the pane.
   ============================================================ */

export function CampaignDraft({
  draft,
  nouns,
  onQueue,
  onEdit,
}: {
  draft: DraftCampaign;
  nouns: Nouns | null;
  /** returns once the channel has created it */
  onQueue: (subject: string) => Promise<unknown>;
  onEdit: () => void;
}) {
  /* which subject is picked and whether it's been queued belong to THIS
     draft — the parent keys this component on it, so a new one arrives
     with both reset rather than an effect chasing the prop */
  const [pick, setPick] = useState(0);
  const [state, setState] = useState<'idle' | 'saving' | 'queued' | 'failed'>('idle');

  const subject = draft.subjects[pick] ?? draft.subjects[0] ?? '';
  const word = nouns?.one ?? 'campaign';

  const queue = () => {
    setState('saving');
    onQueue(subject)
      .then(() => setState('queued'))
      .catch(() => setState('failed'));
  };

  return (
    <section className="c-sec accent es-draft">
      <div className="es-box-head">
        <h2>The {word}</h2>
        <span>ready — nothing goes out until you approve it</span>
      </div>

      <div className="es-subjects">
        <div className="es-label">Subject — pick one</div>
        {draft.subjects.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`es-subject${i === pick ? ' is-pick' : ''}`}
            onClick={() => setPick(i)}
          >
            <span className="es-radio" />
            <span className="es-subject-t">{s}</span>
            {i === 0 ? <span className="es-tag">mine</span> : null}
          </button>
        ))}
      </div>

      <div className="es-mail">
        <div className="es-mail-head">
          <b>{subject}</b>
          <span>{draft.preview}</span>
        </div>
        <div className="es-mail-body">
          {draft.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {draft.ps ? <p className="es-ps">{draft.ps}</p> : null}
        </div>
        <div className="es-mail-foot">
          <span>To · {draft.audience}</span>
          <span>Goes · {draft.when}</span>
        </div>
      </div>

      {draft.rules.length ? (
        <div className="es-rules">
          <div className="es-label">Applied without asking — from your own {nouns?.many ?? 'campaigns'}</div>
          <ul>
            {draft.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="es-next">
        <div className="es-label">What happens if you say yes</div>
        <ol>
          {draft.next.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ol>
      </div>

      <div className="es-draft-act">
        {state === 'queued' ? (
          <span className="es-queued">Queued for review — it’s in the pane, waiting for you.</span>
        ) : (
          <button type="button" className="cta" onClick={queue} disabled={state === 'saving'}>
            {state === 'saving' ? 'Queueing…' : 'Queue it for review →'}
          </button>
        )}
        <button type="button" className="es-restart" onClick={onEdit}>
          Change an answer
        </button>
      </div>
      {state === 'failed' ? (
        <p className="es-fineprint">Couldn’t queue it — the server didn’t take it. Try again.</p>
      ) : null}
    </section>
  );
}
