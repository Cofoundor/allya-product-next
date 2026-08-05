'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import { Transcript } from '@/components/Transcript';
import { Composer } from '@/components/workspace/Composer';
import { BrandCrumbs } from '@/components/workspace/Crumbs';
import { AccountPill } from '@/components/surface/AccountPill';
import { useInterview } from '@/lib/useInterview';
import { channelAccent, channelOf, NOUNS_FALLBACK } from '@/lib/channels';
import {
  composeCampaign,
  ideasFrom,
  type AnswerKey,
  type Answers,
  type Campaign,
  type Idea,
} from '@/lib/email-campaign';
import type { ChannelPage, Send, WorkList } from '@/lib/api/types';
import { IdeaBrain } from './IdeaBrain';
import { CampaignDraft } from './CampaignDraft';
import { CampaignInputs } from './CampaignInputs';
import { CampaignPane } from './CampaignPane';
import { CampaignSheet } from './CampaignSheet';
import { HealthBox, KnowBox, KpiBoxes } from './ChannelBoxes';

/* ============================================================
   A channel, opened all the way up.

   One page for email and WhatsApp both: the brain for this direction, the
   numbers under it, what Allya knows and whether the channel can reach
   anyone at all — then the conversation that writes a campaign, and the
   pane of everything running and everything that already ran.

   Nothing here is channel-specific except the config it's handed and the
   words the API sends with the data.
   ============================================================ */

export default function ChannelStudio({ channelId }: { channelId: string }) {
  const channel = channelOf(channelId);
  const pageRes = useResource<ChannelPage>(paths.direction(channelId));
  const workRes = useResource<WorkList>(paths.work('marketing'));

  const [answers, setAnswers] = useState<Answers>({});
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [open, setOpen] = useState<Send | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const page = pageRes.data ?? null;
  const nouns = page?.nouns ?? NOUNS_FALLBACK;
  const accent = useMemo(() => channelAccent(channel), [channel]);
  const ideas = useMemo(() => ideasFrom(page), [page]);
  const work = useMemo(
    () =>
      (workRes.data?.items ?? []).filter(
        (w) => w.id === page?.awaiting || channel.workRe.test(`${w.title ?? ''} ${w.say ?? ''}`),
      ),
    [workRes.data, page?.awaiting, channel],
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

  /* a thought's box, or the button in the pane: both open the conversation
     with however much is already known */
  const write = useCallback(
    (from?: { label: string; acc?: Answers }) => {
      setOpen(null);
      setEngaged(true);
      start(from);
      inputRef.current?.focus();
    },
    [start],
  );

  const writeFrom = useCallback(
    (idea: Idea) => write({ label: idea.label, acc: idea.seed ? { point: idea.seed } : {} }),
    [write],
  );

  /** re-ask one question, keeping every other answer */
  const changeAnswer = useCallback(
    (key: AnswerKey) => {
      const acc = { ...answers };
      delete acc[key];
      write({ label: 'Changing one answer', acc });
    },
    [answers, write],
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
            { label: page?.label ?? channel.label },
          ]}
        />
        <div className="spacer" />
        <div className="status-line">
          <span className={`pulse${pageRes.error ? ' off' : ''}`} />
          <span>
            {pageRes.error
              ? 'Server unreachable'
              : `${running} ${running === 1 ? nouns.automations.replace(/s$/, '') : nouns.automations} running${
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
              <p className="canvas-greet">{page?.blurb ?? ' '}</p>

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
                <IdeaBrain
                  channel={channel}
                  ideas={ideas}
                  work={work}
                  loading={pageRes.loading}
                  onWrite={writeFrom}
                />
              )}

              <KpiBoxes stats={page?.stats ?? []} />

              <div className="es-pair">
                <KnowBox title={channel.knowTitle} notes={page?.notes ?? []} />
                <HealthBox health={page?.health ?? null} />
              </div>

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
            <div className="day-mark">Today · {channel.label.toLowerCase()}</div>
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
            suggestions={channel.suggestions}
            placeholder={interview.asking ? 'Answer in your own words…' : channel.placeholder}
          />
        </section>

        <aside className="pane-work es-pane" aria-label="Campaigns">
          <CampaignPane
            page={page}
            work={work}
            nouns={nouns}
            loading={pageRes.loading}
            error={!!pageRes.error}
            onCreate={() => write()}
            onOpen={setOpen}
            onRetry={retry}
          />
        </aside>
      </main>

      <CampaignSheet send={open} nouns={nouns} onClose={() => setOpen(null)} />
    </div>
  );
}
