'use client';

import { useState } from 'react';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import { usePersonSheet } from '@/lib/crm/personSheet';
import type { PersonList } from '@/lib/api/types';

/* ============================================================
   Who a campaign is actually going to.

   `audience` is prose — "Signups who never opened" — because that's how a
   founder thinks about it. This is the other half: the segment that
   sentence resolves to, and the people in it. Opening one opens the same
   record the people layer opens, without leaving the campaign.

   It's collapsed by default. A founder reading a campaign wants to know
   what it says; the roster is there for the moment they want to know who,
   which is usually the moment before they approve it.
   ============================================================ */

export function SegmentRoster({ segmentId, audience }: { segmentId: string | null; audience: string }) {
  const [open, setOpen] = useState(false);
  const { openPerson } = usePersonSheet();
  const res = useResource<PersonList>(open && segmentId ? paths.segmentPeople(segmentId) : null);

  // a campaign written before the layer existed has prose and nothing behind
  // it — say the audience plainly rather than offering a door that opens on
  // nothing
  if (!segmentId) return <>to {audience.toLowerCase()}</>;

  return (
    <>
      to{' '}
      <button type="button" className="pl-aud" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {audience.toLowerCase()}
        <span className="pl-aud-caret" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <span className="pl-roster">
          {res.loading ? <span className="es-empty">counting them…</span> : null}
          {res.error ? <span className="es-empty">Couldn’t read who’s in it.</span> : null}
          {res.data ? (
            <>
              <span className="pl-roster-head">{res.data.caption}</span>
              {res.data.people.slice(0, 12).map((p) => (
                <button type="button" className="pl-roster-row" key={p.id} onClick={() => openPerson(p.id)}>
                  <span className="pl-roster-n">{p.name}</span>
                  <span className="pl-roster-m">{p.note || p.email || p.warmth}</span>
                </button>
              ))}
              {res.data.total > 12 ? (
                <span className="pl-roster-more">and {res.data.total - 12} more</span>
              ) : null}
            </>
          ) : null}
        </span>
      ) : null}
    </>
  );
}
