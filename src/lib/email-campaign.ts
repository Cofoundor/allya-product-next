/* ============================================================
   Email marketing, as a conversation.

   Five answers is the whole brief. This module owns the questions, the
   ideas the brain shows, and the composition that turns answers into a
   campaign you can read. Nothing here invents a fact about the business:
   the founder's own sentences carry every claim, and the standing rules
   come from what the API already knows about their sends.

   composeCampaign() is deliberately a pure function of (answers, page).
   When a real generator exists it replaces this one body and nothing
   else in the page has to change.
   ============================================================ */

import type { EmailPage, Sequence } from './api/types';

export type AnswerKey = 'audience' | 'point' | 'proof' | 'ask' | 'when';

export type Answers = Partial<Record<AnswerKey, string>>;

export interface Question {
  key: AnswerKey;
  /** the small line above Allya's bubble */
  tag: string;
  /** what she asks */
  ask: string;
  /** 'answer' → the chip IS the answer; 'starter' → it opens the sentence
      and the founder finishes it. The two questions that carry the claims
      must be in their words, so a chip there can only be a running start. */
  chipsAre: 'answer' | 'starter';
  /** offered as chips — typing something else always works */
  options: (page: EmailPage | null) => string[];
  /** what she says back, so an answer visibly lands */
  ack: (answer: string) => string;
}

const stat = (page: EmailPage | null, id: string) => page?.stats.find((s) => s.id === id)?.value ?? null;
const seq = (page: EmailPage | null, id: string): Sequence | undefined =>
  page?.sequences.find((s) => s.id === id);

export const QUESTIONS: Question[] = [
  {
    key: 'audience',
    tag: 'Who it goes to',
    ask: 'Who is this one for? Everyone, or a slice of the list.',
    chipsAre: 'answer',
    options: (page) => {
      const list = stat(page, 'list');
      const welcome = seq(page, 'welcome')?.audience;
      const winback = seq(page, 'winback')?.audience;
      return [
        list ? `Everyone — ${list} on the list` : 'Everyone on the list',
        welcome ? `New signups — ${welcome}` : 'New signups this month',
        winback ? `Gone quiet — ${winback}` : 'The ones who went quiet',
        'The cold addresses being warmed',
      ];
    },
    ack: (a) => `${a}. Good — that changes how blunt I can be.`,
  },
  {
    key: 'point',
    tag: 'The one thing',
    ask: 'What does it have to say? One sentence, in your words — I write around it, I don’t replace it.',
    chipsAre: 'starter',
    options: () => ['We just shipped ', 'I got this wrong: ', 'Here’s what changed this month: '],
    ack: () => 'That’s the spine of it. Everything else hangs off that line.',
  },
  {
    key: 'proof',
    tag: 'What backs it',
    ask: 'What backs it up? A number, someone’s words, a before and after — or nothing yet, which is fine.',
    chipsAre: 'starter',
    options: () => ['The number is ', 'A customer put it better: ', 'Before, ', 'Nothing yet'],
    ack: (a) =>
      a.toLowerCase().startsWith('nothing')
        ? 'Then we say it plain. A claim with no proof reads better naked than dressed up.'
        : 'Good. That goes right under the opening line, before anyone decides to stop reading.',
  },
  {
    key: 'ask',
    tag: 'The ask',
    ask: 'And at the end — what do you want them to do?',
    chipsAre: 'answer',
    options: () => ['Reply with one word', 'Book a call', 'Start the free month', 'Nothing — just read it'],
    ack: (a) =>
      a.toLowerCase().startsWith('reply')
        ? 'One-word replies are where your replies actually come from. That goes in the P.S.'
        : `“${a}” it is — once, at the end, not three times through.`,
  },
  {
    key: 'when',
    tag: 'When it goes',
    ask: 'When should it go out?',
    chipsAre: 'answer',
    options: () => ['Tuesday, 9am', 'Tomorrow, 8am', 'Hold it until I say'],
    ack: () => 'Right. Give me a moment and I’ll write it.',
  },
];

/* ---- the ideas the brain shows -------------------------------------- */

export type IdeaState = 'live' | 'draft' | 'idea';

export interface Idea {
  id: string;
  label: string;
  /** one line, read on the panel when the dot is tapped */
  note: string;
  state: IdeaState;
  /** the concrete things under it — leaves in the graph */
  moves: { id: string; label: string }[];
  /** what it puts in the composer when you start a campaign from it */
  seed: string;
  /** the work item this thought mirrors, so the dot breathes when it's
      the one waiting on the founder */
  work?: string;
}

/** Ideas that aren't running yet. Craft, not claims — nothing here asserts
    anything about the business that the API hasn't already said. */
const UNPURSUED: Idea[] = [
  {
    id: 'i-split',
    label: 'Split the list by what they open',
    note: 'One list is one guess. Two lists are two guesses you can check.',
    state: 'idea',
    moves: [
      { id: 'i-split-1', label: 'Openers of the last three' },
      { id: 'i-split-2', label: 'Everyone else' },
    ],
    seed: 'The people who open everything should hear something different from the people who never do.',
  },
  {
    id: 'i-plain',
    label: 'A plain send, from you',
    note: 'No header, no template. The ones that read like a person get answered.',
    state: 'idea',
    moves: [
      { id: 'i-plain-1', label: 'No template' },
      { id: 'i-plain-2', label: 'Signed by you' },
    ],
    seed: '',
  },
  {
    id: 'i-one',
    label: 'Ask the quiet ones one question',
    note: 'Not a campaign — a question. The answers are worth more than the opens.',
    state: 'idea',
    moves: [{ id: 'i-one-1', label: 'One line, one question' }],
    seed: 'I want to know why you stopped opening these.',
  },
];

/** What email is doing right now, as ideas: the sequences that run, the
    send that's queued, the warm-up in flight — then the ones not started. */
export function ideasFrom(page: EmailPage | null): Idea[] {
  if (!page) return UNPURSUED;
  const out: Idea[] = [];

  const next = page.sends.find((s) => s.state === 'scheduled');
  if (next) {
    out.push({
      id: 'i-next',
      label: 'The next send',
      note: `${next.subject} — ${next.when}, to ${next.audience.toLowerCase()}`,
      state: 'draft',
      moves: [
        { id: 'i-next-when', label: next.when },
        { id: 'i-next-who', label: next.audience },
      ],
      seed: next.subject,
      // the queued send is usually the thing waiting on the founder
      work: page.awaiting ?? undefined,
    });
  }

  for (const s of page.sequences) {
    out.push({
      id: `i-${s.id}`,
      label: s.name,
      note: `${s.trigger} · ${s.stat}`,
      state: s.state === 'live' ? 'live' : 'draft',
      moves: [
        { id: `i-${s.id}-t`, label: s.trigger },
        { id: `i-${s.id}-a`, label: s.audience },
      ],
      seed: '',
    });
  }

  if (page.progress) {
    out.push({
      id: 'i-warm',
      label: page.progress.label,
      note: `day ${page.progress.value} of ${page.progress.of} · ${page.progress.note}`,
      state: 'live',
      moves: [{ id: 'i-warm-1', label: `day ${page.progress.value} of ${page.progress.of}` }],
      seed: '',
    });
  }

  return [...out, ...UNPURSUED];
}

/* ---- composition ----------------------------------------------------- */

export interface Campaign {
  /** the pick first, then the ones it was chosen over */
  subjects: string[];
  preview: string;
  body: string[];
  ps: string | null;
  audience: string;
  when: string;
  /** what was applied without being asked, and why */
  rules: string[];
  next: string[];
}

const strip = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/[.…]+$/, '');

/** the part before the first comma or dash — usually the sharper line */
function firstClause(s: string) {
  const cut = strip(s).split(/\s*[—–,;:]\s*/)[0];
  return cut.length >= 12 ? cut : strip(s);
}

function askLine(ask: string): { close: string; ps: string | null } {
  const a = ask.toLowerCase();
  if (a.startsWith('reply')) {
    return {
      close: 'If that’s you, say so — one word is enough.',
      ps: 'P.S. — reply with one word and I’ll know it landed.',
    };
  }
  if (a.startsWith('book')) return { close: 'If it’s worth twenty minutes, book a time and we’ll talk it through.', ps: null };
  if (a.startsWith('start')) return { close: 'The first month is free, if you want to see it on your own work.', ps: null };
  return { close: 'Nothing to do with this one. It’s just worth knowing.', ps: null };
}

/**
 * Turn five answers into something readable. Every claim in the result is a
 * sentence the founder typed; the composition only decides order, framing
 * and what goes in the subject line.
 */
export function composeCampaign(answers: Answers, page: EmailPage | null): Campaign {
  const point = strip(answers.point || '');
  const proof = strip(answers.proof || '');
  const hasProof = !!proof && !proof.toLowerCase().startsWith('nothing');
  const { close, ps } = askLine(answers.ask || '');

  const subjects = Array.from(
    new Set([point, firstClause(point), hasProof ? proof : ''].map((s) => s.trim()).filter(Boolean)),
  ).slice(0, 3);

  const body = [point, hasProof ? proof : '', close].filter(Boolean);

  return {
    subjects,
    preview: hasProof ? proof : firstClause(point),
    body,
    ps,
    audience: answers.audience || 'Everyone on the list',
    when: answers.when || 'Hold it until I say',
    // the standing rules are the API's, learned from their own sends
    rules: page?.notes ?? [],
    next: [
      'Your brand expert reads it before anyone else does.',
      'It comes back to you with whatever they changed, marked.',
      'Nothing sends until you approve it.',
    ],
  };
}
