'use client';

import { useState } from 'react';
import type { Campaign } from '@/lib/email-campaign';

/* ============================================================
   The campaign, ready.

   Written out of the five answers — the founder's own sentences carry
   every claim, so the only thing on offer here is order, framing and
   which line goes in the subject. Three subjects, because picking one is
   faster than asking for one.
   ============================================================ */

export function CampaignDraft({ campaign, onEdit }: { campaign: Campaign | null; onEdit: () => void }) {
  /* A fresh campaign is a fresh decision — which subject is picked and
     whether it's been queued belong to THIS draft. The parent keys this
     component on the campaign, so a new one remounts with both reset
     rather than an effect chasing the prop. */
  const [pick, setPick] = useState(0);
  const [queued, setQueued] = useState(false);

  if (!campaign) {
    return (
      <section className="c-sec es-draft is-empty">
        <div className="es-box-head">
          <h2>The campaign</h2>
          <span>after the questions</span>
        </div>
        <p className="es-empty">
          Answer the five and it lands here — subject lines, the body, the P.S., and who it goes to.
        </p>
      </section>
    );
  }

  const subject = campaign.subjects[pick] ?? campaign.subjects[0] ?? '';

  return (
    <section className="c-sec accent es-draft">
      <div className="es-box-head">
        <h2>The campaign</h2>
        <span>ready — nothing sends until you approve it</span>
      </div>

      <div className="es-subjects">
        <div className="es-label">Subject — pick one</div>
        {campaign.subjects.map((s, i) => (
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
          <span>{campaign.preview}</span>
        </div>
        <div className="es-mail-body">
          {campaign.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {campaign.ps ? <p className="es-ps">{campaign.ps}</p> : null}
        </div>
        <div className="es-mail-foot">
          <span>To · {campaign.audience}</span>
          <span>Goes · {campaign.when}</span>
        </div>
      </div>

      {campaign.rules.length ? (
        <div className="es-rules">
          <div className="es-label">Applied without asking — from your own sends</div>
          <ul>
            {campaign.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="es-next">
        <div className="es-label">What happens if you say yes</div>
        <ol>
          {campaign.next.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ol>
      </div>

      <div className="es-draft-act">
        {queued ? (
          <span className="es-queued">Queued for review — it waits for you.</span>
        ) : (
          <button type="button" className="cta" onClick={() => setQueued(true)}>
            Queue it for review →
          </button>
        )}
        <button type="button" className="es-restart" onClick={onEdit}>
          Change an answer
        </button>
      </div>
      <p className="es-fineprint">
        Queueing is local to this page for now — the campaign endpoint doesn’t exist in the API yet.
      </p>
    </section>
  );
}
