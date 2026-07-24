'use client';

import type { CSSProperties } from 'react';
import { PressButton } from '@/components/Pressable';
import { AgentIcon, ArrowIcon, ExpertIcon } from '@/components/icons';
import { knowledgeNotes, personalise, type Derived } from '@/lib/onboarding-data';

/* "What Allya can do for you" — everything on this screen is derived from
   what the founder actually said, so it reads as understanding rather than
   a form receipt. Cards rise in on a stagger. */
export function Showcase({ data, onEnter }: { data: Derived; onEnter: () => void }) {
  let step = 0;
  const rise = (): CSSProperties => ({ animationDelay: `${60 + step++ * 55}ms` });

  return (
    <section className="ob-screen ob-show">
      <div className="ob-show-inner">
        <div className="ob-show-eyebrow">
          <span className="ob-eyebrow-dot" /> Your cofounder is live
        </div>
        <h1 className="ob-show-lead rise-in" style={{ animationDelay: '20ms' }}>
          {data.companyName}, as I understand it.
        </h1>
        <p className="ob-show-sub">
          Here&rsquo;s what I took from our conversation — and the work I can start taking off your plate today.
        </p>

        <div className="ob-card ob-pitch ob-pitch-lead rise-in" style={rise()}>
          <div className="ob-kicker">Your elevator pitch</div>
          <p>{data.pitch}</p>
        </div>

        <div className="ob-facts">
          <div className="ob-card ob-fact rise-in" style={rise()}>
            <div className="ob-kicker">Your ideal customer</div>
            <div className="ob-fact-val">{data.customer.text}</div>
          </div>
          <div className="ob-card ob-fact rise-in" style={rise()}>
            <div className="ob-kicker">Where you are</div>
            <div className="ob-fact-val">
              <span className="ob-seg">{data.rev.badge}</span>
              <br />
              {data.rev.line}
            </div>
          </div>
          <div className="ob-card ob-fact rise-in" style={rise()}>
            <div className="ob-kicker">What you&rsquo;re driving at</div>
            {data.goalList.length ? (
              <ul className="ob-goals-list">
                {data.goalList.map((g, i) => (
                  <li key={g}>
                    <span className="gn">{i + 1}</span>
                    {g}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="ob-fact-val">Ready when you are.</div>
            )}
          </div>
        </div>

        <div className="ob-can">
          <div className="ob-can-head">
            <h3>What I can do for {data.companyName}</h3>
            <span className="ob-split">
              <b>85%</b> agents · <b>15%</b> real experts · nothing ships without you
            </span>
          </div>
          <div className="ob-can-grid">
            {(() => {
              const seenByDept: Record<string, number> = {};
              return data.capabilities.map((c) => {
                const seen = seenByDept[c.dept] || 0;
                seenByDept[c.dept] = seen + 1;
                return (
                  <div className={`ob-cap rise-in${c.origin === 'expert' ? ' exp' : ''}`} key={c.title} style={rise()}>
                    <span className="ob-cap-ic">{c.origin === 'expert' ? <ExpertIcon /> : <AgentIcon />}</span>
                    <div className="ob-cap-copy">
                      <div className="ob-cap-title">{c.title}</div>
                      <div className="ob-cap-line">{personalise(c, data, seen)}</div>
                    </div>
                    <span className={`pill${c.origin === 'expert' ? ' expert' : ''}`}>{c.origin}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="ob-know">
          <div className="ob-know-head">
            <h3>What I&rsquo;m carrying into every task</h3>
            <span className="ob-know-note">Picked up from your answers — I won&rsquo;t ask twice.</span>
          </div>
          <div className="ob-know-grid">
            {knowledgeNotes(data).map((n) => (
              <div className="ob-know-item" key={n.k}>
                <span className="ob-know-k">{n.k}</span>
                <span className="ob-know-v">{n.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ob-launch rise-in" style={rise()}>
          <div className="ob-launch-copy">
            <div className="t">Looking good — let me refine it.</div>
            <div className="s">
              A few quick multiple-choice questions so I can dial in the details.
            </div>
          </div>
          <PressButton type="button" className="cta ob-enter" pressScale={0.97} onClick={onEnter}>
            Continue
            <ArrowIcon size={17} />
          </PressButton>
        </div>
      </div>
    </section>
  );
}
