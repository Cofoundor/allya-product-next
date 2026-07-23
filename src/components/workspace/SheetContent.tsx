'use client';

import { useState, type ReactNode } from 'react';
import { PersonIcon } from '@/components/icons';

/* What's inside the approval surface, per context. The provenance trail
   is the load-bearing part: who touched this, in what order, and the
   fact that it stops at you. */

function Draft({ kicker, title, body, tags }: { kicker: string; title: string; body: string; tags: string[] }) {
  return (
    <div className="draft">
      <div className="kicker">{kicker}</div>
      <h4>{title}</h4>
      <p>{body}</p>
      <div className="tags">
        {tags.map((t) => (
          <span className="tag" key={t}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

interface TrailRow {
  kind: 'agent' | 'expert' | 'you';
  txt: string;
  time?: string;
  toggle?: boolean;
}

function Trail({ rows, diff }: { rows: TrailRow[]; diff?: ReactNode }) {
  const [openDiff, setOpenDiff] = useState(false);
  return (
    <div className="trail">
      {rows.map((r) => (
        <div className={`trail-row${r.kind === 'you' ? ' now' : ''}`} key={r.txt}>
          <span className={`t-dot ${r.kind}`}>{r.kind === 'expert' ? <PersonIcon /> : null}</span>
          <span className="t-txt">{r.txt}</span>
          {r.toggle ? (
            <button type="button" className="trail-toggle" onClick={() => setOpenDiff((v) => !v)}>
              {openDiff ? 'hide the edits' : 'see the edits'}
            </button>
          ) : null}
          {r.time ? <span className="t-time">{r.time}</span> : null}
        </div>
      ))}
      {diff && openDiff ? <div className="trail-diff">{diff}</div> : null}
    </div>
  );
}

export function sheetApproveLabel(context: string) {
  return context === 'newsletter' ? 'Approve — schedule it' : 'Book both interviews';
}

export function SheetHead({ context }: { context: string }) {
  if (context === 'newsletter') {
    return (
      <>
        <div className="avatar">A</div>
        <div>
          <div className="who">
            Allya <span className="role">· with your PR expert</span>
          </div>
          <div className="line">Next week’s newsletter. Read it, then approve — nothing sends until you do.</div>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="avatar human">
        <PersonIcon />
      </div>
      <div>
        <div className="who">Your hiring expert</div>
        <div className="line">Six through the first screen. Here are the two I’d spend your time on.</div>
      </div>
    </>
  );
}

export function SheetBody({ context }: { context: string }) {
  if (context === 'newsletter') {
    return (
      <>
        <Trail
          rows={[
            { kind: 'agent', txt: 'Drafted by agent', time: '6:12am' },
            { kind: 'expert', txt: 'Your PR expert edited 2 lines', time: '6:58am', toggle: true },
            { kind: 'you', txt: 'Waiting on you — nothing ships without this step' },
          ]}
          diff={
            <>
              <div className="d-pair">
                <div className="d-old">We ran 13 marketing campaigns for SurferSearcher last month</div>
                <div className="d-new">The agency did 13 campaigns. In one month.</div>
              </div>
              <div className="d-pair">
                <div className="d-old">Our AI-powered platform can streamline your marketing</div>
                <div className="d-new">You didn’t start a company to write newsletters at 11pm.</div>
              </div>
            </>
          }
        />
        <Draft
          kicker="Subject line"
          title="The agency did 13 campaigns. In one month."
          body="Leads with the SurferSearcher number. No adjectives — the figure carries it."
          tags={['open rate angle', 'A/B ready']}
        />
        <Draft
          kicker="Body"
          title="You didn’t start a company to write newsletters at 11pm."
          body="Three short paragraphs. One idea each. Ends on your actual offer, not a pitch."
          tags={['your voice', 'expert edited']}
        />
        <Draft
          kicker="P.S."
          title="Reply with one word — the thing eating your week. I’ll take it from there."
          body="Asks for a single reply so you can start real conversations, not track opens."
          tags={['1 reply goal']}
        />
        <p className="undo-note">
          After you approve, it holds for 10 minutes before actually sending — you can pull it back.
        </p>
      </>
    );
  }

  return (
    <>
      <Trail
        rows={[
          { kind: 'agent', txt: 'Agent screened 6 candidates overnight', time: '5:30am' },
          { kind: 'expert', txt: 'Your hiring expert sat in on the top two', time: '8:15am' },
          { kind: 'you', txt: 'Waiting on you — your call, always' },
        ]}
      />
      <Draft
        kicker="#1 — Ananya R."
        title="Ran ops solo at a seed-stage fintech for 2 years."
        body="Did the messy version of this job with no team. Strong on the parts you hate."
        tags={['ops', 'seed-stage', 'available in 2 wks']}
      />
      <Draft
        kicker="#2 — Karan M."
        title="Built the hiring pipeline at a 4-person startup."
        body="Less ops depth, more range. Would grow into it fast. Worth the second slot."
        tags={['generalist', 'fast start']}
      />
      <p className="sheet-note">
        The other four weren’t a fit for the JD you approved. I can share the notes if you want them.
      </p>
    </>
  );
}
