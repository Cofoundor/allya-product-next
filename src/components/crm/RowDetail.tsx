'use client';

import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import type { PersonDetail, TouchBy } from '@/lib/api/types';

/* ============================================================
   A row, opened where it sits.

   The sheet is for reading somebody properly. This is for the moment in
   the middle — you're scanning forty rows, one of them looks wrong, and
   you want to know why without losing your place in the grid.

   So it carries the things you'd otherwise open the sheet for: how to
   reach them, what's on the table, what's owed, the last few things that
   happened, and the moves — which are dispatchable from right here,
   because a CRM you can only read from is the thing we already fixed.
   ============================================================ */

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const when = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function RowDetail({
  personId,
  cols,
  busy,
  onOpen,
  onTake,
}: {
  personId: string;
  /** how many columns to span, so the panel lines up under the row */
  cols: number;
  busy: boolean;
  onOpen: () => void;
  onTake: (moveId: string, by: TouchBy) => void;
}) {
  const res = useResource<PersonDetail>(paths.person(personId));
  const p = res.data;

  return (
    <tr className="pl-tbl-detail">
      <td colSpan={cols}>
        {res.error ? (
          <p className="pl-tbl-none">Couldn’t read them — the server didn’t answer.</p>
        ) : !p ? (
          <p className="pl-tbl-none">reading the record…</p>
        ) : (
          <div className="pl-rd">
            <div className="pl-rd-col">
              <h4>How to reach them</h4>
              <dl className="pl-rd-dl">
                <dt>Email</dt>
                <dd>{p.email ?? '—'}</dd>
                <dt>Phone</dt>
                <dd>{p.phone ?? '—'}</dd>
                <dt>Handle</dt>
                <dd>{p.handle ?? '—'}</dd>
                <dt>Company</dt>
                <dd>{p.company?.name ?? '—'}</dd>
                <dt>Came in</dt>
                <dd>{p.originSaid || '—'}</dd>
              </dl>
              {p.tags.length ? (
                <div className="pl-rd-tags">
                  {p.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="pl-rd-col">
              <h4>On the table</h4>
              {p.deals.length ? (
                p.deals.map((d) => (
                  <p className="pl-rd-line" key={d.id}>
                    <b>{money(d.value)}</b> {d.title}
                    <span> · {d.state}</span>
                  </p>
                ))
              ) : (
                <p className="pl-tbl-none">Nothing priced yet.</p>
              )}

              <h4>Owed</h4>
              {p.followups.filter((f) => f.state === 'open').length ? (
                p.followups
                  .filter((f) => f.state === 'open')
                  .map((f) => (
                    <p className="pl-rd-line" key={f.id}>
                      <b>{f.due}</b> {f.what}
                      {f.by !== 'you' ? <span> · {f.by} has it</span> : null}
                    </p>
                  ))
              ) : (
                <p className="pl-tbl-none">Nothing owed.</p>
              )}

              {p.segments.length ? (
                <>
                  <h4>In</h4>
                  <p className="pl-rd-line">{p.segments.join(' · ')}</p>
                </>
              ) : null}
            </div>

            <div className="pl-rd-col">
              <h4>What happened</h4>
              {p.touches.slice(0, 5).map((t) => (
                <p className="pl-rd-line" key={t.id}>
                  <span className={`t-dot ${t.by}`} aria-hidden />
                  <b>{when(t.at)}</b> {t.text}
                </p>
              ))}
              {!p.touches.length ? <p className="pl-tbl-none">Nothing yet.</p> : null}
            </div>

            <div className="pl-rd-col">
              <h4>What you could do</h4>
              {/* dispatchable from the grid: the whole point of the table
                  being the front door is that you can work from it */}
              <div className="pl-rd-moves">
                {p.next.map((mv) =>
                  mv.does.map((by) => (
                    <button
                      type="button"
                      key={`${mv.id}-${by}`}
                      className="pl-rd-move"
                      disabled={busy}
                      onClick={() => onTake(mv.id, by)}
                      title={by === 'you' ? mv.ownTitle : mv.workTitle}
                    >
                      {mv.label}
                      <span>{by === 'you' ? 'you' : by}</span>
                    </button>
                  )),
                )}
              </div>
              <button type="button" className="pl-ghost pl-rd-open" onClick={onOpen}>
                Open the whole record →
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
