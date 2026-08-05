'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { createCampaign, draftCampaign, paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import { GROUPS, branchTints } from '@/lib/brain';
import { Transcript } from '@/components/Transcript';
import { Composer } from '@/components/workspace/Composer';
import { BrandCrumbs } from '@/components/workspace/Crumbs';
import { AccountPill } from '@/components/surface/AccountPill';
import { useInterview } from '@/lib/useInterview';
import type {
  AnswerKey,
  Answers,
  ChannelPage,
  DraftCampaign,
  Idea,
  Question,
  Send,
  WorkItem,
} from '@/lib/api/types';
import { IdeaBrain } from './IdeaBrain';
import { CampaignDraft } from './CampaignDraft';
import { CampaignPane } from './CampaignPane';
import { CampaignSheet } from './CampaignSheet';
import { HealthBox, KnowBox, KpiBoxes } from './ChannelBoxes';

/* ============================================================
   A channel, opened all the way up.

   One page for email and WhatsApp both, and it knows nothing about
   either: the copy, the hue, the questions, the thoughts, the campaigns
   and the writing all arrive from /directions/{id}. Swap the dummy
   backend for a real one and nothing in here moves.
   ============================================================ */

export default function ChannelStudio({ channelId }: { channelId: string }) {
  const pageRes = useResource<ChannelPage>(paths.direction(channelId));
  const listRes = useResource<Send[]>(paths.campaigns(channelId));
  const ideasRes = useResource<Idea[]>(paths.ideas(channelId));
  const questionsRes = useResource<Question[]>(paths.questions(channelId));
  const workRes = useResource<WorkItem[]>(paths.directionWork(channelId));

  const [answers, setAnswers] = useState<Answers>({});
  const [draft, setDraft] = useState<DraftCampaign | null>(null);
  const [writing, setWriting] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const page = pageRes.data;
  const work = useMemo(() => workRes.data ?? [], [workRes.data]);
  const accent = useMemo(
    () => (page ? (branchTints(GROUPS.marketing)[page.ui.tint] ?? GROUPS.marketing) : GROUPS.marketing),
    [page],
  );

  const onProgress = useCallback((a: Answers) => {
    setAnswers(a);
    setDraft(null); // a changed answer un-writes the campaign it produced
  }, []);

  /* the writing is the backend's: five answers in, a campaign out */
  const onDone = useCallback(
    (a: Answers) => {
      setAnswers(a);
      setWriting(true);
      draftCampaign(channelId, a)
        .then(setDraft)
        .catch(() => setDraft(null))
        .finally(() => setWriting(false));
    },
    [channelId],
  );

  const interview = useInterview({
    channelId,
    questions: questionsRes.data,
    onProgress,
    onDone,
  });
  const { start } = interview;

  const write = useCallback(
    (from?: { label: string; acc?: Answers }) => {
      setOpenId(null);
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

  /** queue it: a real POST, and the pane re-reads the collection */
  const queue = useCallback(
    (subject: string) =>
      createCampaign(channelId, answers, subject).then((made) => {
        listRes.reload();
        return made;
      }),
    [answers, channelId, listRes],
  );

  const retry = useCallback(() => {
    pageRes.reload();
    listRes.reload();
    ideasRes.reload();
    questionsRes.reload();
    workRes.reload();
  }, [pageRes, listRes, ideasRes, questionsRes, workRes]);

  const down = pageRes.error;
  const running = page?.sequences.filter((s) => s.state === 'live').length ?? 0;
  const needs = work.filter((w) => w.status === 'needs-you');
  const automations = page?.nouns.automations ?? 'automations';

  return (
    <div className="app is-service" style={{ ['--accent' as string]: accent }}>
      <header className="topbar">
        <BrandCrumbs
          trail={[
            { label: 'Company', href: '/' },
            { label: 'Marketing', href: '/marketing' },
            { label: page?.label ?? '…' },
          ]}
        />
        <div className="spacer" />
        <div className="status-line">
          <span className={`pulse${down ? ' off' : ''}`} />
          <span>
            {down
              ? 'Server unreachable'
              : pageRes.loading
                ? 'reading the channel…'
                : `${running} ${running === 1 ? automations.replace(/s$/, '') : automations} running${
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
              <p className={`canvas-greet${page ? '' : ' sk-text'}`}>{page?.blurb ?? ' '}</p>

              {down ? (
                <div className="c-sec brain-box brain-tall brain-down">
                  <p className="brain-down-copy">
                    {down.offline ? 'The brain is offline — I can’t reach the server.' : down.message}
                    <button type="button" className="link-btn" onClick={retry}>
                      Try again
                    </button>
                  </p>
                </div>
              ) : (
                <IdeaBrain
                  channelId={channelId}
                  page={page}
                  ideas={ideasRes.data ?? []}
                  work={work}
                  loading={ideasRes.loading || pageRes.loading}
                  onWrite={writeFrom}
                />
              )}

              <KpiBoxes stats={page?.stats ?? []} />

              {page ? (
                <div className="es-pair">
                  <KnowBox title={page.ui.knowTitle} notes={page.notes} />
                  <HealthBox health={page.health} />
                </div>
              ) : null}

              <p className="canvas-hint">Touch a thought above, or talk to Allya below</p>
            </div>
          </div>

          <Transcript
            className="thread-scroll"
            messages={interview.messages}
            typing={interview.typing || writing}
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
            <div className="day-mark">Today · {page?.label.toLowerCase() ?? '…'}</div>
          </Transcript>

          {draft ? (
            <div className="es-draft-slot">
              <CampaignDraft
                key={draft.subjects.join('|')}
                draft={draft}
                nouns={page?.nouns ?? null}
                onQueue={queue}
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
            suggestions={page?.ui.suggestions ?? []}
            placeholder={
              interview.asking ? 'Answer in your own words…' : (page?.ui.placeholder ?? 'Direct Allya…')
            }
          />
        </section>

        <aside className="pane-work es-pane" aria-label="Campaigns">
          <CampaignPane
            page={page}
            campaigns={listRes.data ?? []}
            work={work}
            nouns={page?.nouns ?? null}
            loading={listRes.loading}
            error={!!listRes.error}
            onCreate={() => write()}
            onOpen={(s) => setOpenId(s.id)}
            onRetry={retry}
          />
        </aside>
      </main>

      <CampaignSheet
        channelId={channelId}
        campaignId={openId}
        nouns={page?.nouns ?? null}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
