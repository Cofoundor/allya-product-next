'use client';

import type { ViewOption } from '@/lib/api/types';

export type CrmView = 'table' | 'people' | 'companies';

/* ============================================================
   Which lens you're looking through.

   It lives in the header rather than inside a pane, because a control that
   swaps the whole page shouldn't sit inside the thing it swaps — each view
   was drawing its own version of it, in its own corner, worded differently.

   The list comes from the page's own dressing (`ui.views`), like every other
   word on this screen. Until it arrives there is nothing to draw: a switch
   that renders three guesses and then corrects itself is worse than one that
   waits a beat.
   ============================================================ */

export function ViewSwitch({
  views,
  view,
  onPick,
}: {
  views: ViewOption[];
  view: CrmView;
  onPick: (v: CrmView) => void;
}) {
  if (!views.length) return null;

  return (
    <div className="pl-views" role="tablist" aria-label="How to look at the book">
      {views.map((v) => (
        <button
          type="button"
          role="tab"
          key={v.id}
          aria-selected={v.id === view}
          title={v.note}
          className={`pl-view${v.id === view ? ' is-on' : ''}`}
          onClick={() => onPick(v.id as CrmView)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
