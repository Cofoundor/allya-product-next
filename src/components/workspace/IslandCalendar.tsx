'use client';

import { useMemo, useState } from 'react';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import type { CalendarDay, CalendarMonth, DayAgenda } from '@/lib/api/types';

/* ============================================================
   The calendar that lives in the expanded island's left half.

   The month grid is the company at a glance — a dot per thing on a day, lit
   in the accent when that thing is waiting on you. Picking a day pulls its
   agenda from the server; an entry that sits on a work item opens that item's
   approval sheet, so the calendar is a way into the work, not a read-only
   decoration beside it.
   ============================================================ */

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/* six week-rows, always. A month needs at most 37 cells, and a fixed grid
   means stepping between months moves nothing but the numbers. */
const CELLS = 42;
/* three is enough to read as "busy"; more is noise in a 36px cell */
const MAX_MARKS = 3;

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function IslandCalendar({
  surfaceId,
  onOpenWork,
}: {
  surfaceId: string;
  /** open a work item's approval sheet — the island closes behind it */
  onOpenWork: (id: string) => void;
}) {
  // null means "whichever month the server calls current"
  const [month, setMonth] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const monthRes = useResource<CalendarMonth>(paths.calendar(surfaceId, month));
  const cal = monthRes.data;
  const date = picked ?? cal?.selected ?? null;
  const dayRes = useResource<DayAgenda>(date ? paths.calendarDay(surfaceId, date) : null);
  const agenda = dayRes.data;

  const busy = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    (cal?.days ?? []).forEach((d) => map.set(d.date, d));
    return map;
  }, [cal]);

  /* the whole grid, as ISO dates and holes — computing it here keeps the
     null-checks out of the markup */
  const cells = useMemo(() => {
    const out: (string | null)[] = [];
    for (let i = 0; i < CELLS; i += 1) {
      const n = cal ? i - cal.firstWeekday + 1 : 0;
      out.push(cal && n >= 1 && n <= cal.daysInMonth ? `${cal.month}-${String(n).padStart(2, '0')}` : null);
    }
    return out;
  }, [cal]);

  const go = (by: number) => {
    if (!cal) return;
    setMonth(shiftMonth(cal.month, by));
    setPicked(null); // the day we were on belongs to the month we just left
  };

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="cal-nav" aria-label="Previous month" disabled={!cal} onClick={() => go(-1)}>
          ‹
        </button>
        <span className="cal-label">{cal?.label ?? ' '}</span>
        <button type="button" className="cal-nav" aria-label="Next month" disabled={!cal} onClick={() => go(1)}>
          ›
        </button>
      </div>

      {monthRes.error ? (
        <div className="idet-note">Couldn&rsquo;t reach the calendar.</div>
      ) : (
        <div className="cal-grid" role="grid" aria-label={cal?.label ?? 'Calendar'}>
          {DOW.map((d, i) => (
            <span className="cal-dow" key={i}>
              {d}
            </span>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <span className="cal-blank" key={i} />;
            const n = Number(iso.slice(8));
            const info = busy.get(iso);
            const cls = ['cal-cell'];
            if (iso === cal?.today) cls.push('today');
            if (iso === date) cls.push('on');
            if (info) cls.push('has');
            return (
              <button
                type="button"
                key={i}
                className={cls.join(' ')}
                aria-pressed={iso === date}
                aria-label={`${n}${info ? ` — ${info.count} scheduled` : ''}`}
                onClick={() => setPicked(iso)}
              >
                <span className="cal-n">{n}</span>
                <span className="cal-marks">
                  {info
                    ? Array.from({ length: Math.min(info.count, MAX_MARKS) }, (_, k) => (
                        <span key={k} className={`cal-mark${k < info.needsYou ? ' needs' : ''}`} />
                      ))
                    : null}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="cal-day">
        <div className="idet-group">{agenda?.label ?? ' '}</div>
        {agenda?.note ? <div className="idet-note">{agenda.note}</div> : null}
        {(agenda?.events ?? []).map((e) => {
          const wid = e.workId;
          const body = (
            <>
              <span className="cal-ev-when">{e.when}</span>
              <span className="cal-ev-what">{e.what}</span>
              {e.pill ? (
                <span className={`pill${e.origin === 'expert' ? ' expert' : ''}`}>{e.pill}</span>
              ) : null}
            </>
          );
          const cls = `cal-ev k-${e.kind}`;
          return wid ? (
            <button type="button" key={e.id} className={cls} onClick={() => onOpenWork(wid)}>
              {body}
            </button>
          ) : (
            <div key={e.id} className={cls}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
