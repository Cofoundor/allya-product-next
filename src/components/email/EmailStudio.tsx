'use client';

import { useCallback, useMemo, useState } from 'react';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import { GROUPS, branchTints } from '@/lib/brain';
import { BrandCrumbs } from '@/components/workspace/Crumbs';
import { AccountPill } from '@/components/surface/AccountPill';
import {
  composeCampaign,
  ideasFrom,
  type AnswerKey,
  type Answers,
  type Campaign,
  type Idea,
} from '@/lib/email-campaign';
import type { EmailPage, WorkList } from '@/lib/api/types';
import { IdeaBrain } from './IdeaBrain';
import { CampaignChat, type Seed } from './CampaignChat';
import { CampaignDraft } from './CampaignDraft';
import { CampaignInputs } from './CampaignInputs';
import { OngoingCampaigns } from './OngoingCampaigns';

/* ============================================================
   Email marketing, as one page.

   The brain at the top holds this one direction and nothing else: what
   runs, and what's only an idea. Under it the conversation — five
   questions and a campaign you can read — then everything already in
   flight, and the inputs every one of them was made from.

   The page owns the answers. The chat collects them, the brief shows
   them, the draft is composed from them: one source, three views.
   ============================================================ */

export default function EmailStudio() {
  const pageRes = useResource<EmailPage>(paths.direction('email'));
  const workRes = useResource<WorkList>(paths.work('marketing'));

  const [answers, setAnswers] = useState<Answers>({});
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [seed, setSeed] = useState<Seed | null>(null);

  const page = pageRes.data ?? null;
  const accent = useMemo(() => branchTints(GROUPS.marketing).b4, []);
  const ideas = useMemo(() => ideasFrom(page), [page]);
  const work = useMemo(
    () => (workRes.data?.items ?? []).filter((w) => w.id.startsWith('em') || /email|newsletter|warm/i.test(w.title ?? '')),
    [workRes.data],
  );

  const onProgress = useCallback((a: Answers) => {
    setAnswers(a);
    setCampaign(null); // a changed answer un-writes the campaign it produced
  }, []);

  const onDone = useCallback(
    (a: Answers) => {
      setAnswers(a);
      setCampaign(composeCampaign(a, page));
    },
    [page],
  );

  /** the brain hands an idea down: restart, already knowing this much */
  const startFromIdea = useCallback((idea: Idea) => {
    setSeed((s) => ({
      label: idea.label,
      acc: idea.seed ? { point: idea.seed } : {},
      nonce: (s?.nonce ?? 0) + 1,
    }));
  }, []);

  /** re-ask one question, keeping every other answer */
  const changeAnswer = useCallback(
    (key: AnswerKey) => {
      const acc = { ...answers };
      delete acc[key];
      setSeed((s) => ({ label: 'Changing one answer', acc, nonce: (s?.nonce ?? 0) + 1 }));
    },
    [answers],
  );

  const retry = useCallback(() => {
    pageRes.reload();
    workRes.reload();
  }, [pageRes, workRes]);

  return (
    <div className="app is-service" style={{ ['--accent' as string]: accent }}>
      <header className="topbar">
        <BrandCrumbs
          trail={[
            { label: 'Company', href: '/' },
            { label: 'Marketing', href: '/marketing' },
            { label: page?.label ?? 'Email' },
          ]}
        />
        <div className="spacer" />
        <div className="status-line">
          <span className={`pulse${pageRes.error ? ' off' : ''}`} />
          <span>
            {pageRes.error
              ? 'Server unreachable'
              : `${page?.sequences.filter((s) => s.state === 'live').length ?? 0} sequences running${
                  work.length ? ` · ${work.length} needs you` : ''
                }`}
          </span>
        </div>
        <AccountPill />
      </header>

      <main className="es-page">
        <div className="es-inner">
          <h1 className="canvas-greet">
            {page?.blurb ?? 'The channel you own. Nobody can throttle it, so it has to be worth opening.'}
          </h1>

          <IdeaBrain ideas={ideas} onStart={startFromIdea} loading={pageRes.loading} />

          {page?.stats.length ? (
            <section className="c-sec es-stats">
              {page.stats.map((s) => (
                <div className="es-stat" key={s.id}>
                  <b>{s.value}</b>
                  <span className="l">{s.label}</span>
                  {s.delta ? <span className="d">{s.delta}</span> : null}
                </div>
              ))}
            </section>
          ) : null}

          <CampaignChat page={page} seed={seed} onProgress={onProgress} onDone={onDone} />

          <CampaignDraft
            key={campaign ? campaign.subjects.join('|') : 'empty'}
            campaign={campaign}
            onEdit={() => changeAnswer('point')}
          />

          <CampaignInputs answers={answers} page={page} onChange={changeAnswer} />

          <OngoingCampaigns
            page={page}
            work={work}
            loading={pageRes.loading}
            error={!!pageRes.error}
            onRetry={retry}
          />
        </div>
      </main>
    </div>
  );
}
