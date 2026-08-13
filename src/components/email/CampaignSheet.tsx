'use client';

import { useEffect } from 'react';
import { useReducedMotion } from '@/lib/hooks';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import { SegmentRoster } from '@/components/crm/SegmentRoster';
import type { CampaignDetail, Nouns } from '@/lib/api/types';

/* ============================================================
   One campaign, opened.

   Every campaign in the pane is a thing you can read, not a row you can
   only count: what it said, what it did, who it went to. It grows out of
   the row you tapped, the same way a dot page grows out of its dot.
   ============================================================ */

export function CampaignSheet({
  channelId,
  campaignId,
  nouns,
  onClose,
}: {
  channelId: string;
  /** which campaign to open; null closes the sheet */
  campaignId: string | null;
  nouns: Nouns | null;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  // the row carries enough to rank it; the body only comes with the detail
  const res = useResource<CampaignDetail>(campaignId ? paths.campaign(channelId, campaignId) : null);
  const send = res.data;

  useEffect(() => {
    if (!campaignId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [campaignId, onClose]);

  if (!campaignId) return null;
  const out = send?.state === 'sent';

  return (
    <div className="dot-layer is-open es-camp-layer">
      <div className="dot-wash" onClick={onClose} />
      <section
        className="dot-sheet es-camp"
        role="dialog"
        aria-modal="true"
        aria-label={send?.subject ?? 'Campaign'}
        style={reduced ? undefined : undefined}
      >
        <div className="dot-scroll">
          <div className="dot-head">
            <button type="button" className="dot-back" onClick={onClose}>
              ← Campaigns
            </button>
            <span className="dot-crumb">
              {send?.state ?? '…'} · {nouns?.one ?? 'campaign'}
            </span>
          </div>

          {res.error ? (
            <>
              <h1 className="dot-title">Couldn’t open it</h1>
              <p className="dot-blurb">
                {res.error.offline ? 'The server is unreachable.' : res.error.message}
              </p>
              <button type="button" className="cta" onClick={res.reload}>
                Try again
              </button>
            </>
          ) : !send ? (
            <>
              <h1 className="dot-title sk-text">Opening…</h1>
              <p className="dot-blurb sk-text">reading the campaign</p>
            </>
          ) : (
            <>
          <h1 className="dot-title">{send.subject}</h1>
          <p className="dot-blurb">
            {send.when} · <SegmentRoster segmentId={send.segmentId} audience={send.audience} />
          </p>

          {/* what's worth showing is the channel's call: a draft has an
              audience and an approval, one that's out has opens and replies */}
          <div className="es-camp-stats">
            {send.kpis.map((k) => (
              <div className="es-camp-kpi" key={k.id}>
                <b>{k.value}</b>
                <span className="l">{k.label}</span>
                {k.delta ? <span className="d">{k.delta}</span> : null}
              </div>
            ))}
          </div>

          {send.dates.length ? (
            <div className="es-camp-dates">
              {send.dates.map((d) => (
                <span className="es-camp-date" key={d.label}>
                  <span className="k">{d.label}</span>
                  <span className="v">{d.value}</span>
                </span>
              ))}
            </div>
          ) : null}

          {!out && send.outcome ? (
            <div className="es-camp-pending">
              <span className="brain-live" />
              {send.outcome}
            </div>
          ) : null}

          <div className="dot-sec">What it says</div>
          <div className="es-camp-body">
            {send.body.length ? (
              send.body.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p className="es-camp-none">The body of this one isn’t stored yet.</p>
            )}
            {send.ps ? <p className="es-camp-ps">{send.ps}</p> : null}
          </div>

          {out && send.outcome ? (
            <>
              <div className="dot-sec">What it did</div>
              <p className="es-camp-outcome">{send.outcome}</p>
            </>
          ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
