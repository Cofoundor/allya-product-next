'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import { GROUPS, branchTints } from '@/lib/brain';
import { Transcript } from '@/components/Transcript';
import { Composer } from '@/components/workspace/Composer';
import { BrandCrumbs } from '@/components/workspace/Crumbs';
import { AccountPill } from '@/components/surface/AccountPill';
import { useInterview } from '@/lib/useInterview';
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
import { CampaignDraft } from './CampaignDraft';
import { CampaignInputs } from './CampaignInputs';
import { OngoingCampaigns } from './OngoingCampaigns';

/* ============================================================
   Email marketing — one direction, opened all the way up.

   Same shell as a floor, because it is one level of the same building:
   the brain in the canvas, the conversation behind it, everything in
   flight down the right-hand pane. Touch a thought, read what it is,
   and the button at the bottom of that box drops you into the
   conversation with the thought already in Allya's hands.
   ============================================================ */

export default function EmailStudio() {
  const pageRes = useResource<EmailPage>(paths.direction('email'));
  const workRes = useResource<WorkList>(paths.work('marketing'));

  const [answers, setAnswers] = useState<Answers>({});
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [engaged, setEngaged] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const page = pageRes.data ?? null;
  const accent = useMemo(() => branchTints(GROUPS.marketing).b4, []);
  const ideas = useMemo(() => ideasFrom(page), [page]);
  const work = useMemo(
    () =>
      (workRes.data?.items ?? []).filter(
        (w) => /email|newsletter|warm|list/i.test(`${w.title ?? ''} ${w.say ?? ''}`) || w.id === page?.awaiting,
      ),
    [workRes.data, page?.awaiting],
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

  const interview = useInterview({ page, onProgress, onDone });
  const { start } = interview;

  /* a thought's box hands the campaign over: the canvas steps back and the
     conversation takes the pane, already knowing what the thought knew */
  const writeFrom = useCallback(
    (idea: Idea) => {
      setEngaged(true);
      start({ label: idea.label, acc: idea.seed ? { point: idea.seed } : {} });
      inputRef.current?.focus();
    },
    [start],
  );

  /** re-ask one question, keeping every other answer */
  const changeAnswer = useCallback(
    (key: AnswerKey) => {
      const acc = { ...answers };
      delete acc[key];
      setEngaged(true);
      start({ label: 'Changing one answer', acc });
    },
    [answers, start],
  );

  const retry = useCallback(() => {
    pageRes.reload();
    workRes.reload();
  }, [pageRes, workRes]);

  const running = page?.sequences.filter((s) => s.state === 'live').length ?? 0;
  const needs = work.filter((w) => w.status === 'needs-you');

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
              : `${running} sequence${running === 1 ? '' : 's'} running${
                  needs.length ? ` · ${needs.length} needs you` : ''
                }`}
          </span>
        </div>
        <AccountPill />
      </header>

      <main className="workspace">
        <section className={`pane-chat${engaged ? ' engaged' : ''}`} aria-label="Conversation with Allya">
          <div className="canvas">
            <div className="canvas-inner svc-inner">
              <p className="canvas-greet">
                {page?.blurb ?? 'The channel you own. Nobody can throttle it, so it has to be worth opening.'}
              </p>

              {pageRes.error ? (
                <div className="c-sec brain-box brain-tall brain-down">
                  <p className="brain-down-copy">
                    The brain is offline — I can&rsquo;t reach the server.
                    <button type="button" className="link-btn" onClick={retry}>
                      Try again
                    </button>
                  </p>
                </div>
              ) : (
                <IdeaBrain ideas={ideas} work={work} loading={pageRes.loading} onWrite={writeFrom} />
              )}

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

              <CampaignInputs answers={answers} page={page} onChange={changeAnswer} />

              <p className="canvas-hint">Touch a thought above, or talk to Allya below</p>
            </div>
          </div>

          <Transcript
            className="thread-scroll"
            messages={interview.messages}
            typing={interview.typing}
            chips={interview.chips.map((c) => ({
              label: c.label,
              // a starter opens the sentence and hands the founder the pen —
              // only they can put a claim in a campaign
              act: () => {
                if (c.kind === 'starter') {
                  const el = inputRef.current;
                  if (el) {
                    // React owns this input; go through its own setter
                    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
                    set?.call(el, c.text);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.focus();
                  }
                } else {
                  interview.submit(c.text);
                }
              },
            }))}
            onChip={(c) => c.act()}
          >
            <div className="day-mark">Today · email</div>
            {campaign ? null : (
              <div className="es-thread-note">
                {interview.started ? null : 'Five questions and you have a campaign.'}
              </div>
            )}
          </Transcript>

          {campaign ? (
            <div className="es-draft-slot">
              <CampaignDraft
                key={campaign.subjects.join('|')}
                campaign={campaign}
                onEdit={() => changeAnswer('point')}
              />
            </div>
          ) : null}

          <Composer
            inputRef={inputRef}
            onSend={(t) => {
              if (!interview.started) start();
              interview.submit(t);
            }}
            onEngage={() => setEngaged(true)}
            onDisengage={() => {
              setEngaged(false);
              inputRef.current?.blur();
            }}
            suggestions={page ? ['Write next week’s newsletter', 'Win back the quiet ones', 'A plain send, from me'] : []}
            placeholder={interview.asking ? 'Answer in your own words…' : 'Direct Allya — what should this one say?'}
          />
        </section>

        <aside className="pane-work" aria-label="Campaigns">
          <div className="work-head">
            <h2>Campaigns</h2>
            <span className="split-note">
              {page?.sends.length ?? 0} sends · {page?.sequences.length ?? 0} sequences
            </span>
          </div>
          <div className="es-pane-scroll">
            <OngoingCampaigns
              page={page}
              work={work}
              loading={pageRes.loading}
              error={!!pageRes.error}
              onRetry={retry}
              bare
            />
          </div>
        </aside>
      </main>
    </div>
  );
}
