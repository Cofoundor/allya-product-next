'use client';

import type { ReactNode } from 'react';
import { PressButton, PressDiv } from '@/components/Pressable';
import type { WorkItem } from '@/lib/api/types';

/* The one lime-lit card: something is waiting on your eyes. Used in both
   the work panel and the home canvas — the canvas strips its chrome in CSS. */
export function ApprovalCard({
  item,
  ctaLabel,
  onOpen,
  after,
}: {
  item: WorkItem;
  ctaLabel: string;
  onOpen: () => void;
  /** what sits beside the CTA — the "nothing ships" hint, or a Later button */
  after?: ReactNode;
}) {
  return (
    <PressDiv className="approval-card" role="button" tabIndex={0} onClick={onOpen} pressScale={0.99}>
      <div className="who">
        <span className="avatar">{item.who}</span>
        <span className="name">
          {item.whoName} <span className="role">· {item.whoRole}</span>
        </span>
      </div>
      <p className="say">{item.say}</p>
      <div className={after ? 'c-card-act' : 'act'}>
        <PressButton
          type="button"
          className="cta"
          pressScale={0.95}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {ctaLabel}
        </PressButton>
        {after}
      </div>
    </PressDiv>
  );
}
