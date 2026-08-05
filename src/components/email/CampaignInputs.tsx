'use client';

import { QUESTIONS, type Answers, type AnswerKey } from '@/lib/email-campaign';
import type { EmailPage } from '@/lib/api/types';

/* ============================================================
   The inputs — everything a campaign was made of.

   Top half is the one being written: five rows, filling in as the
   questions get answered, each one clickable to change your mind. Bottom
   half is the same view of everything already running, built from what
   the API actually stores about a send: who it goes to, what sets it off,
   what state it's in. No row here is inferred.
   ============================================================ */

const LABEL: Record<AnswerKey, string> = {
  audience: 'Who it goes to',
  point: 'The one thing',
  proof: 'What backs it',
  ask: 'The ask',
  when: 'When it goes',
};

export function CampaignInputs({
  answers,
  page,
  onChange,
}: {
  answers: Answers;
  page: EmailPage | null;
  /** re-ask one question, keeping the rest */
  onChange: (key: AnswerKey) => void;
}) {
  const filled = QUESTIONS.filter((q) => answers[q.key]).length;

  const running = [
    ...(page?.sends ?? [])
      .filter((s) => s.state !== 'sent')
      .map((s) => ({ id: s.id, name: s.subject, who: s.audience, sets: s.when, state: s.state })),
    ...(page?.sequences ?? []).map((q) => ({
      id: q.id,
      name: q.name,
      who: q.audience,
      sets: q.trigger,
      state: q.state,
    })),
  ];

  return (
    <section className="c-sec es-inputs">
      <div className="es-box-head">
        <h2>The inputs</h2>
        <span>{filled} of {QUESTIONS.length} answered</span>
      </div>

      <div className="es-brief">
        {QUESTIONS.map((q) => {
          const v = answers[q.key];
          return (
            <button
              key={q.key}
              type="button"
              className={`es-brief-row${v ? '' : ' is-blank'}`}
              disabled={!v}
              onClick={() => onChange(q.key)}
            >
              <span className="es-brief-k">{LABEL[q.key]}</span>
              <span className="es-brief-v">{v || 'not answered yet'}</span>
              {v ? <span className="es-brief-x">change</span> : null}
            </button>
          );
        })}
      </div>

      {running.length ? (
        <>
          <div className="es-label es-inputs-sep">What the running ones were made of</div>
          <div className="es-table" role="table">
            <div className="es-tr es-th" role="row">
              <span role="columnheader">Campaign</span>
              <span role="columnheader">Who</span>
              <span role="columnheader">What sets it off</span>
              <span role="columnheader">State</span>
            </div>
            {running.map((r) => (
              <div className="es-tr" role="row" key={r.id}>
                <span role="cell" className="es-td-t">
                  {r.name}
                </span>
                <span role="cell">{r.who}</span>
                <span role="cell">{r.sets}</span>
                <span role="cell">
                  <span className={`es-pill s-${r.state}`}>{r.state}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
