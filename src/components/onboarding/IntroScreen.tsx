'use client';

import { PressButton } from '@/components/Pressable';
import { ArrowIcon } from '@/components/icons';

export function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="ob-screen ob-intro">
      <div className="ob-intro-inner">
        <div className="ob-eyebrow">
          <span className="ob-eyebrow-dot" /> AI Onboarding
        </div>
        <h1 className="ob-title">
          Let&rsquo;s get your
          <br />
          business <span className="ob-title-accent">onboarded.</span>
        </h1>
        <p className="ob-lede">
          A short, focused conversation with your AI cofounder. The more you share, the sharper Allya plans, thinks,
          and works for you — and you&rsquo;ll watch it build a live model of your company as you talk.
        </p>
        <ul className="ob-assure">
          <li>
            <b>Answers lock once given.</b> Take your time — depth beats speed here.
          </li>
          <li>
            <b>Nothing is lost.</b> Leave anytime, resume where you left off.
          </li>
          <li>
            <b>Watch the brain build.</b> Every answer adds to your company map.
          </li>
          <li>
            <b>Then see what Allya can do.</b> Concrete work, mapped to your goals.
          </li>
        </ul>
        <PressButton type="button" className="cta ob-start" pressScale={0.96} onClick={onStart}>
          Start onboarding
          <ArrowIcon size={17} />
        </PressButton>
        <p className="ob-meta">6 questions · about 3 minutes</p>
      </div>
    </section>
  );
}
