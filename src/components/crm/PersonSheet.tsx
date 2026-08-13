'use client';

import { useCallback, useEffect, useState } from 'react';
import { logTouch, movePersonStage, paths, setFollowup, takeMove } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import { usePersonSheet } from '@/lib/crm/personSheet';
import { useLexicon } from '@/lib/crm/lexicon';
import type { Journey, PersonDetail, Pipeline, TouchBy } from '@/lib/api/types';
import { JourneyTrail } from './JourneyTrail';
import { MoveRow } from './MoveRow';

/* ============================================================
   One person, opened.

   Mounted once, high up, and opened by id from anywhere — a band on the
   funnel, a campaign's audience, a work item, a day on the calendar. It
   never changes route, because the whole promise of the layer is that a
   person is one place rather than a page you navigate to and come back
   from.

   The head says where they stand and who's been working them; the deals
   say what's on the table; the trail is the journey.
   ============================================================ */

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/* Which expert covers a floor, and how a warmth reads in a record, both used
   to be constants here. They're the API's vocabulary — see GET /crm/lexicon.
   The house rule still holds at the source: generic by discipline, never a
   name, because the seam between agent and human is the product's claim. */

function ownerSaid(owner: string, surfaceId: string | undefined,
                   expertOf: (s: string | undefined) => string) {
  if (owner === 'you') return 'you';
  if (owner === 'expert') return expertOf(surfaceId);
  return 'an agent';
}


function initials(name: string) {
  const parts = name.replace(/[^\p{L}\s.—-]/gu, '').split(/[\s—-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

/** `pipelines` is a courtesy from the people layer, which already has them.
    Anywhere else — a campaign, a work item, a day on the calendar — the
    sheet fetches its own, so it can be dropped in with no other change. */
export function PersonSheet({
  pipelines,
  onChanged,
}: {
  pipelines?: Pipeline[];
  /** moving someone changes every count derived from where they stood, and
      useResource doesn't subscribe to invalidation — whoever owns those
      reads has to be told, the way the campaign pane already is */
  onChanged?: () => void;
}) {
  const { personId, closePerson } = usePersonSheet();
  const { warmthSaidFull, expertOf } = useLexicon();
  const res = useResource<PersonDetail>(personId ? paths.person(personId) : null);
  const journeyRes = useResource<Journey>(personId ? paths.journey(personId) : null);
  const ownRes = useResource<Pipeline[]>(personId && !pipelines ? paths.pipelines() : null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const person = res.data;
  const open = (person?.followups ?? []).filter((f) => f.state === 'open');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!personId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePerson();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [personId, closePerson]);

  const reload = useCallback(() => {
    res.reload();
    journeyRes.reload();
    onChanged?.();
  }, [res, journeyRes, onChanged]);

  const move = useCallback(
    async (stageId: string) => {
      if (!personId) return;
      setBusy(true);
      try {
        await movePersonStage(personId, stageId);
        reload();
      } finally {
        setBusy(false);
      }
    },
    [personId, reload],
  );

  /** the hinge: dispatch it or keep it, and either way something real
      exists afterwards — a work item in the work list, or a dated
      follow-up that can go overdue */
  const take = useCallback(
    async (moveId: string, by: TouchBy) => {
      if (!personId) return;
      setBusy(true);
      try {
        const r = await takeMove(personId, moveId, by);
        setToast(r.toast);
        reload();
      } catch (e) {
        setToast(e instanceof Error ? e.message : 'That didn’t take.');
      } finally {
        setBusy(false);
      }
    },
    [personId, reload],
  );

  const close = useCallback(
    async (fid: string) => {
      if (!personId) return;
      setBusy(true);
      try {
        await setFollowup(fid, personId, { state: 'done' });
        reload();
      } finally {
        setBusy(false);
      }
    },
    [personId, reload],
  );

  /** pushing keeps it open on purpose — a follow-up you can silently
      dismiss is one that never chases you */
  const push = useCallback(
    async (fid: string) => {
      if (!personId) return;
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setBusy(true);
      try {
        await setFollowup(fid, personId, { due: d.toISOString().slice(0, 10) });
        reload();
      } finally {
        setBusy(false);
      }
    },
    [personId, reload],
  );

  const addNote = useCallback(
    async (text: string) => {
      if (!personId || !text) return;
      setBusy(true);
      try {
        await logTouch(personId, text);
        reload();
      } finally {
        setBusy(false);
      }
    },
    [personId, reload],
  );

  if (!personId) return null;

  const known = pipelines ?? ownRes.data ?? [];
  const pipeline = known.find((p) => p.id === person?.pipelineId) ?? null;
  const stage = pipeline?.stages.find((s) => s.id === person?.stageId) ?? null;

  return (
    <div className="dot-layer is-open pl-sheet-layer">
      <div className="dot-wash" onClick={closePerson} />
      <section
        className="dot-sheet pl-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={person?.name ?? 'Person'}
      >
        <div className="dot-scroll">
          <div className="dot-head">
            <button type="button" className="dot-back" onClick={closePerson}>
              ← Close
            </button>
            <span className="dot-crumb">
              {person ? `${person.kinds.join(' · ')} · ${warmthSaidFull(person.warmth)}` : '…'}
            </span>
          </div>

          {res.error ? (
            <>
              <h1 className="dot-title">Couldn’t open them</h1>
              <p className="dot-blurb">
                {res.error.offline ? 'The server is unreachable.' : res.error.message}
              </p>
              <button type="button" className="cta" onClick={reload}>
                Try again
              </button>
            </>
          ) : !person ? (
            <>
              <h1 className="dot-title sk-text">Opening…</h1>
              <p className="dot-blurb sk-text">reading the record</p>
            </>
          ) : (
            <>
              <div className="pl-head">
                <span className={`pl-av lg w-${person.warmth}`} aria-hidden>
                  {initials(person.name)}
                </span>
                <div className="pl-head-copy">
                  <h1 className="dot-title">{person.name}</h1>
                  <p className="dot-blurb">
                    {person.company?.name ? `${person.company.name} · ` : null}
                    {person.email ?? person.phone ?? person.handle ?? 'no address on file'}
                  </p>
                </div>
              </div>

              {person.note ? <p className="pl-read">{person.note}</p> : null}

              {/* where they stand. Tapping a stage moves them, and the move
                  joins the journey rather than quietly editing a field. */}
              {pipeline ? (
                <>
                  <div className="dot-sec">Where they stand</div>
                  <div className="pl-stages">
                    {pipeline.stages.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        disabled={busy}
                        className={`pl-stage${s.id === person.stageId ? ' is-on' : ''}`}
                        onClick={() => s.id !== person.stageId && move(s.id)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {stage?.note ? <p className="pl-stage-note">{stage.note}</p> : null}
                </>
              ) : null}

              <div className="pl-facts">
                <Fact k="Worked by" v={ownerSaid(person.owner, pipeline?.surfaceId, expertOf)} />
                <Fact k="Came from" v={person.source || 'unknown'} />
                <Fact k="First seen" v={person.created} />
                {person.tags.length ? <Fact k="Tags" v={person.tags.join(', ')} /> : null}
              </div>

              {person.deals.length ? (
                <>
                  <div className="dot-sec">On the table</div>
                  {person.deals.map((d) => (
                    <div className={`pl-deal s-${d.state}`} key={d.id}>
                      <span className="pl-deal-t">{d.title}</span>
                      <span className="pl-deal-v">{money(d.value)}</span>
                      <span className="pl-deal-m">
                        {d.state === 'open'
                          ? `${d.note || 'open'}${d.expectedClose ? ` · expects ${d.expectedClose}` : ''}`
                          : d.note || d.state}
                      </span>
                    </div>
                  ))}
                </>
              ) : null}

              {person.segments.length ? (
                <>
                  <div className="dot-sec">They’re in</div>
                  <div className="pl-segs is-read">
                    {person.segments.map((s) => (
                      <span className="pl-seg is-read" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}

              {/* where they came from, and what moved them. First touch
                  answers "where do leads come from"; last touch answers the
                  more expensive question — what actually closed them. */}
              <div className="dot-sec">How they got here</div>
              <p className="pl-attr-note">{person.attribution.note}</p>
              {person.attribution.path.length > 1 ? (
                <ol className="pl-path">
                  {person.attribution.path.map((s, i) => (
                    <li
                      className={`pl-path-step${i === 0 ? ' is-first' : ''}${
                        s === person.attribution.last ? ' is-last' : ''
                      }`}
                      key={`${s.at}-${i}`}
                    >
                      <span className="pl-path-ch">{s.channel}</span>
                      <span className="pl-path-t">{s.said}</span>
                    </li>
                  ))}
                </ol>
              ) : null}

              {person.next.length ? (
                <>
                  <div className="dot-sec">What you could do</div>
                  <div className="pl-moves">
                    {person.next.map((mv) => (
                      <MoveRow
                        key={mv.id}
                        move={mv}
                        busy={busy}
                        expertWord={expertOf(pipeline?.surfaceId)}
                        onTake={(by) => take(mv.id, by)}
                      />
                    ))}
                  </div>
                  {toast ? <p className="pl-toast">{toast}</p> : null}
                </>
              ) : null}

              {open.length ? (
                <>
                  <div className="dot-sec">Owed</div>
                  <div className="pl-owed">
                    {open.map((f) => (
                      <div className={`pl-owe${f.due < today ? ' is-late' : ''}`} key={f.id}>
                        <span className="pl-owe-t">{f.what}</span>
                        <span className="pl-owe-d">
                          {f.due < today ? 'late · ' : ''}
                          {f.due}
                          {f.by !== 'you' ? ` · ${f.by} has it` : ''}
                        </span>
                        <span className="pl-owe-acts">
                          <button type="button" disabled={busy} onClick={() => close(f.id)}>
                            Done
                          </button>
                          <button type="button" disabled={busy} onClick={() => push(f.id)}>
                            Push a week
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              <div className="dot-sec">The whole journey</div>
              {/* keyed by person: opening someone else gets an empty box
                  rather than the half-written note about the last one */}
              <NoteBox key={personId} busy={busy} onLog={addNote} />
              <JourneyTrail
                touches={journeyRes.data?.touches ?? person.touches}
                loading={journeyRes.loading && !person.touches.length}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function NoteBox({ busy, onLog }: { busy: boolean; onLog: (text: string) => void }) {
  const [note, setNote] = useState('');
  const send = () => {
    const text = note.trim();
    if (!text) return;
    setNote('');
    onLog(text);
  };
  return (
    <div className="pl-note-row">
      <input
        className="pl-note-in"
        value={note}
        placeholder="Log a call, or what they said…"
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
      />
      <button type="button" className="cta" disabled={busy || !note.trim()} onClick={send}>
        Log it
      </button>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <span className="pl-fact">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </span>
  );
}
