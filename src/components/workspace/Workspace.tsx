'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { haptic } from '@/lib/spring';
import { useTimers } from '@/lib/hooks';
import { useConversation, type Chip } from '@/lib/useConversation';
import { readHandoff, type Handoff } from '@/lib/handoff';
import { INITIAL_WORK, type WorkItem } from '@/lib/workspace-data';
import { Transcript } from '@/components/Transcript';
import { PressButton } from '@/components/Pressable';
import { Island } from './Island';
import { PagePicker } from './PagePicker';
import { HomeCanvas } from './HomeCanvas';
import { WorkPane } from './WorkPane';
import { Composer } from './Composer';
import { ApprovalSheet } from './ApprovalSheet';
import { Toast } from './Toast';

/* ============================================================
   The workspace shell. Conversation on the left, work on the right,
   an approval surface over the top. Every scripted beat lives here so
   the transcript, the work list, and the brain all read the same state.
   ============================================================ */
export default function Workspace() {
  const [work, setWork] = useState<WorkItem[]>(INITIAL_WORK);
  const [engaged, setEngaged] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [tab, setTab] = useState<'chat' | 'work'>('chat');
  const [sheetCtx, setSheetCtx] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [onb, setOnb] = useState<Handoff | null>(null);

  const convo = useConversation();
  const { say, think, showChips, clearChips } = convo;
  const { after } = useTimers();
  const inputRef = useRef<HTMLInputElement>(null);
  const toastId = useRef(0);

  const needs = work.filter((w) => w.status === 'needs-you');
  const running = work.filter((w) => w.status === 'running');

  const showToast = useCallback((text: string) => {
    toastId.current += 1;
    setToast({ text, id: toastId.current });
  }, []);

  const engage = useCallback(() => setEngaged(true), []);
  const disengage = useCallback(() => {
    setEngaged(false);
    inputRef.current?.blur();
  }, []);

  const openSheet = useCallback((id: string) => setSheetCtx(id), []);

  /* ---- work transitions ---- */
  const shipItem = useCallback((id: string, title?: string, meta?: string, undoable?: boolean) => {
    setWork((prev) => {
      const found = prev.find((x) => x.id === id);
      if (!found) return prev;
      const moved: WorkItem = {
        ...found,
        status: 'shipped',
        undoable: !!undoable,
        title: title ?? found.title,
        meta: meta ?? found.meta,
      };
      const rest = prev.filter((x) => x.id !== id);
      // the shipped list shows newest first
      const at = rest.findIndex((x) => x.status === 'shipped');
      const idx = at === -1 ? rest.length : at;
      return [...rest.slice(0, idx), moved, ...rest.slice(idx)];
    });
  }, []);

  /* pull an approved item back inside its undo window */
  const unshipItem = useCallback(
    (id: string) => {
      setWork((prev) => {
        const found = prev.find((x) => x.id === id);
        if (!found) return prev;
        const back: WorkItem = {
          ...found,
          status: 'needs-you',
          undoable: false,
          ...(id === 'newsletter'
            ? {
                title: undefined,
                say: 'Held it — the newsletter is back in your queue, unsent. Take another look whenever.',
              }
            : {}),
        };
        return [back, ...prev.filter((x) => x.id !== id)];
      });
      haptic([10]);
      showToast('Held. Nothing sent.');
      say('you', 'Undo that');
      think(
        () => say('allya', `Pulled it back — nothing went out. It's in your queue again; no harm done.`),
        600,
      );
    },
    [say, think, showToast],
  );

  /* ---- the scripted conversation ---- */
  const scriptFallback = useCallback(() => {
    think(() =>
      say(
        'allya',
        'Noted. I’ll take the first pass and it’ll show up in your work panel before anything ships — you approve, then it goes out.',
      ),
    );
  }, [say, think]);

  const quickSay = useCallback(
    (text: string) => {
      say('you', text);
      const key = text.toLowerCase();
      if (key.includes('book')) {
        think(() =>
          say(
            'allya',
            'Done — both are on your calendar for Thursday. I sent each a short note with the role and what to expect. No prep needed from you.',
          ),
        );
      } else {
        scriptFallback();
      }
    },
    [say, think, scriptFallback],
  );

  const scriptNewsletter = useCallback(() => {
    think(() => {
      say(
        'allya',
        'Good one to get ahead of. I’ll draft next week’s around the SurferSearcher result — 13 campaigns in month one reads better than anything I could invent.',
      );
      think(() => {
        say(
          'allya',
          'I broke it into three: subject lines, the body, and a P.S. that asks for one reply. Your PR expert already tightened two lines. It’s waiting in your work panel.',
        );
        showChips([
          { label: 'Show me the draft', act: () => openSheet('newsletter') },
          { label: 'Change the angle', act: () => quickSay('Change the angle') },
        ]);
      }, 1100);
    });
  }, [say, think, showChips, openSheet, quickSay]);

  const scriptHiring = useCallback(() => {
    think(() => {
      say(
        'allya',
        'You have 6 people through the first screen for the ops role. I ranked them against the JD you approved, not against a résumé template.',
      );
      think(() => {
        say(
          'human',
          'I sat in on the top two — both worth 20 minutes of your time. I’ve held Thursday 3pm and 4pm.',
          { tag: <span className="human-tag">Your hiring expert</span> },
        );
        showChips([
          { label: 'Book both', act: () => quickSay('Book both') },
          { label: 'See the ranking', act: () => openSheet('hiring') },
        ]);
      }, 1400);
    });
  }, [say, think, showChips, openSheet, quickSay]);

  const sendText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      engage();
      clearChips();
      say('you', t);
      const k = t.toLowerCase();
      if (k.includes('news') || k.includes('letter') || k.includes('campaign')) scriptNewsletter();
      else if (k.includes('hir') || k.includes('candidate') || k.includes('screen') || k.includes('interview'))
        scriptHiring();
      else scriptFallback();
    },
    [engage, clearChips, say, scriptNewsletter, scriptHiring, scriptFallback],
  );

  /* ---- approval outcomes ---- */
  const onApprove = useCallback(
    (ctx: string) => {
      haptic([12, 40, 18]);
      setSheetCtx(null);
      after(240, () => {
        if (ctx === 'newsletter') {
          shipItem('newsletter', 'Newsletter approved — goes out Tuesday 9am', 'holds 10 min before sending', true);
          showToast('Scheduled. You have 10 minutes to pull it back.');
          say('you', 'Approved');
          think(
            () =>
              say(
                'allya',
                'Scheduled for Tuesday 9am. It holds for 10 minutes in case you change your mind — after that I’ll watch the replies and pull anything worth your time into here.',
              ),
            700,
          );
        } else {
          showToast('Booked. Thursday 3 & 4pm are on your calendar.');
          say('you', 'Book both');
          think(
            () => say('allya', 'Done. Both are booked, and I sent each a short note so Thursday isn’t cold.'),
            700,
          );
        }
      });
    },
    [after, shipItem, showToast, say, think],
  );

  const onEdit = useCallback(
    (ctx: string) => {
      setSheetCtx(null);
      after(240, () => {
        say('you', 'Ask for a change');
        think(
          () =>
            say(
              'allya',
              ctx === 'newsletter'
                ? 'Tell me what’s off — the angle, the subject line, or the ask — and I’ll have a new pass in the panel within the hour.'
                : 'Tell me what you’d change about the shortlist and I’ll re-rank.',
            ),
          700,
        );
      });
    },
    [after, say, think],
  );

  /* ---- ⌘K / "/" focuses the composer ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement === inputRef.current;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---- opening beats: a tool opens already working ---- */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const handoff = readHandoff();
    setOnb(handoff);
    say(
      'allya',
      handoff?.company
        ? `Morning. ${handoff.company} is set up and I'm already on it — while you slept, three things moved: two shipped, one's waiting on your eyes in the work panel. I never send anything without you.`
        : `Morning. While you slept, three things moved — two shipped, one's waiting on your eyes in the work panel. I never send anything without you.`,
    );
    showChips([
      { label: 'Review the newsletter', act: () => openSheet('newsletter') },
      { label: 'Where’s the ops hire?', act: () => sendText('Where’s the ops hire?') },
    ]);
  }, [say, showChips, openSheet, sendText]);

  const onChip = useCallback(
    (c: Chip) => {
      clearChips();
      c.act();
    },
    [clearChips],
  );

  return (
    <>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="lamp" /> Allya <span className="date">· Tuesday</span>
            <PagePicker />
          </div>
          <nav className="tabs" aria-label="Panes">
            <PressButton
              type="button"
              className={`tab${tab === 'chat' ? ' active' : ''}`}
              pressScale={0.95}
              onClick={() => setTab('chat')}
            >
              Talk
            </PressButton>
            <PressButton
              type="button"
              className={`tab${tab === 'work' ? ' active' : ''}`}
              pressScale={0.95}
              onClick={() => setTab('work')}
            >
              Work {needs.length ? <span className="badge">·{needs.length}</span> : null}
            </PressButton>
          </nav>
          <div className="spacer" />
          <div className="status-line">
            <span className="pulse" />
            <span>
              {running.length} agent{running.length === 1 ? '' : 's'} running
              {needs.length ? ` · ${needs.length} needs you` : ''}
            </span>
          </div>
          <Link className="kbd" href="/onboarding" title="Company onboarding">
            Onboarding
          </Link>
          <button type="button" className="kbd" title="Focus the composer" onClick={() => inputRef.current?.focus()}>
            ⌘K
          </button>
        </header>

        <main className={`workspace${tab === 'work' ? ' show-work' : ''}`}>
          <section className={`pane-chat${engaged ? ' engaged' : ''}`} aria-label="Conversation with Allya">
            <Island work={work} onOpenWork={openSheet} />

            <HomeCanvas work={work} onb={onb} deferred={deferred} onDefer={setDeferred} onOpenSheet={openSheet} />

            <Transcript
              className="thread-scroll"
              messages={convo.messages}
              typing={convo.typing}
              chips={convo.chips}
              onChip={onChip}
            >
              <div className="day-mark">Today</div>
            </Transcript>

            <Composer inputRef={inputRef} onSend={sendText} onEngage={engage} onDisengage={disengage} />
          </section>

          <WorkPane work={work} onOpenSheet={openSheet} onUndo={unshipItem} />
        </main>
      </div>

      <ApprovalSheet
        context={sheetCtx}
        onClose={() => setSheetCtx(null)}
        onApprove={onApprove}
        onEdit={onEdit}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
