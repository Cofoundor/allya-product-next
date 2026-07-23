'use client';

import type { CSSProperties } from 'react';
import { PressButton } from '@/components/Pressable';
import { AgentIcon, ArrowIcon, ExpertIcon } from '@/components/icons';
import { titleCase, type Derived } from '@/lib/onboarding-data';

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

        <div className="ob-essence">
          <div className="ob-card ob-oneword-card rise-in" style={rise()}>
            <div className="ob-kicker">In one word</div>
            <div className="ob-oneword">{data.oneWord}</div>
            <div className="ob-oneword-note">
              The through-line I&rsquo;ll keep in mind on everything I do for you.
            </div>
          </div>
          <div className="ob-card ob-pitch rise-in" style={rise()}>
            <div className="ob-kicker">Your elevator pitch</div>
            <p>{data.pitch}</p>
          </div>
        </div>

        <div className="ob-facts">
          <div className="ob-card ob-fact rise-in" style={rise()}>
            <div className="ob-kicker">The base of the business</div>
            <div className="ob-fact-val">
              <span className="ob-seg">{data.baseSeg}</span>
              <br />
              {titleCase(data.category)}
            </div>
          </div>
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
        </div>

        <div className="ob-facts one-up">
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
            <h3>What I can do for you</h3>
            <span className="ob-split">
              <b>85%</b> agents · <b>15%</b> real experts · nothing ships without you
            </span>
          </div>
          <div className="ob-can-grid">
            {data.capabilities.map((c) => (
              <div className={`ob-cap rise-in${c.origin === 'expert' ? ' exp' : ''}`} key={c.title} style={rise()}>
                <span className="ob-cap-ic">{c.origin === 'expert' ? <ExpertIcon /> : <AgentIcon />}</span>
                <div className="ob-cap-copy">
                  <div className="ob-cap-title">{c.title}</div>
                  <div className="ob-cap-line">{c.line}</div>
                </div>
                <span className={`pill${c.origin === 'expert' ? ' expert' : ''}`}>{c.origin}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ob-launch rise-in" style={rise()}>
          <div className="ob-launch-copy">
            <div className="t">Your workspace is ready.</div>
            <div className="s">
              Walk in and I&rsquo;ll already be working — agents running, one thing waiting on your eyes.
            </div>
          </div>
          <PressButton type="button" className="cta ob-enter" pressScale={0.97} onClick={onEnter}>
            Enter your workspace
            <ArrowIcon size={17} />
          </PressButton>
        </div>
      </div>
    </section>
  );
}
