'use client';

import { useCallback, useState } from 'react';
import { paths, takeMove } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import { usePersonSheet } from '@/lib/crm/personSheet';
import { useLexicon } from '@/lib/crm/lexicon';
import type { Prompt, TouchBy } from '@/lib/api/types';

/* ============================================================
   What to do now.

   Everything else on this layer is a way of looking at people. This is the
   only part that decides. It exists because a founder who opens a hundred
   rows and a dozen columns has been handed a report and asked to do the
   editing themselves — which is the job they came here to stop doing.

   Three at most. A list of twenty priorities is a list of none, and the
   fourth-most-important thing on a Tuesday is not a thing.
   ============================================================ */

/* How urgent a prompt is reads with the API's word for it, not this file's. */

export function StartHere({ onChanged }: { onChanged: () => void }) {
  const res = useResource<Prompt[]>(paths.today());
  const { urgencyWord } = useLexicon();
  const { openPerson } = usePersonSheet();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const take = useCallback(
    async (p: Prompt, by: TouchBy) => {
      if (!p.personId || !p.moveId) return;
      setBusy(true);
      try {
        const r = await takeMove(p.personId, p.moveId, by);
        setDone(r.toast);
        res.reload();
        onChanged();
      } catch (e) {
        setDone(e instanceof Error ? e.message : 'That didn’t take.');
      } finally {
        setBusy(false);
      }
    },
    [res, onChanged],
  );

  const prompts = res.data ?? [];

  // nothing pressing is a real answer, and worth saying out loud rather
  // than leaving a founder to wonder whether it's broken
  if (!res.loading && !prompts.length) {
    return (
      <section className="sh sh-clear">
        <p>
          <b>Nothing needs you today.</b> Everyone who was owed something has had it. The book keeps
          filling itself — come back when something goes late.
        </p>
      </section>
    );
  }

  return (
    <section className="sh" aria-label="What to do now">
      <div className="sh-head">
        <h2>Start here</h2>
        <span>{res.loading ? 'reading the book…' : 'the only three that matter right now'}</span>
      </div>

      <div className="sh-cards">
        {(res.loading ? [0, 1, 2] : prompts).map((p, i) =>
          typeof p === 'number' ? (
            <div className="sh-card sk-text" key={i} style={{ height: 116 }} />
          ) : (
            <article className={`sh-card u-${p.urgency}`} key={p.id}>
              <span className="sh-when">{urgencyWord(p.urgency)}</span>
              <button type="button" className="sh-who" onClick={() => p.personId && openPerson(p.personId)}>
                {p.name}
              </button>
              <p className="sh-why">{p.why}</p>
              {p.does.length ? (
                <div className="sh-do">
                  {/* the same fork the record offers: hand it over, or keep it */}
                  {p.does.includes('agent') ? (
                    <button type="button" className="sh-go" disabled={busy} onClick={() => take(p, 'agent')}>
                      {p.moveLabel} <span>an agent</span>
                    </button>
                  ) : null}
                  {p.does.includes('you') ? (
                    <button type="button" className="sh-mine" disabled={busy} onClick={() => take(p, 'you')}>
                      I’ll do it
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ),
        )}
      </div>

      {done ? <p className="sh-done">{done}</p> : null}
    </section>
  );
}
