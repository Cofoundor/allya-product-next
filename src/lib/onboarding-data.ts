/* ============================================================
   Onboarding — the six questions, and the deterministic reading of
   the answers that produces "what Allya can do for you".

   Everything here is pure: same answers in, same showcase out. It
   echoes the founder's own words back so it reads as understanding
   rather than a form submission.
   ============================================================ */

import type { Cluster } from './brain';

export type QuestionType = 'short' | 'long' | 'choice';

export interface Question {
  key: string;
  tag: string;
  /** the live status shown under the brain while this lands */
  sub: string;
  q: string;
  type: QuestionType;
  placeholder?: string;
  example?: string;
  options?: string[];
  ack: (answer: string) => string;
  cluster: (answer: string) => Cluster;
}

export const QUESTIONS: Question[] = [
  {
    key: 'business',
    tag: 'The business',
    sub: 'Mapping your business',
    q: 'Tell me about your business — what do you do, and who is it for? Say as much as you like; detail makes me sharper.',
    type: 'long',
    placeholder:
      'e.g. We build a scheduling tool for independent salons — booking, reminders, and payments in one app…',
    example: 'We run a D2C coffee brand selling single-origin beans by subscription, plus wholesale to cafés.',
    ack: () => "That's a clear picture. I'm mapping it now — watch it take shape on the right.",
    cluster: () => ({
      id: 'business',
      label: 'Business',
      group: 'marketing',
      leaves: ['Marketing', 'Sales', 'Hiring', 'PR', 'Ops'],
    }),
  },
  {
    key: 'market',
    tag: 'Your market',
    sub: 'Placing you in your market',
    q: 'Who do you sell to — other businesses, everyday consumers, or both?',
    type: 'choice',
    options: ['Businesses', 'Consumers', 'Both'],
    ack: (a) =>
      a === 'Businesses'
        ? 'Businesses it is. That changes who I chase and how I write to them.'
        : a === 'Consumers'
          ? 'Consumers — so volume and voice matter more than long sales cycles. Noted.'
          : "Both, then. I'll keep two tones ready — they don't respond to the same things.",
    cluster: (a) => ({
      id: 'market',
      label: 'Market',
      group: 'market',
      leaves: [a === 'Businesses' ? 'B2B' : a === 'Consumers' ? 'B2C' : 'B2B + B2C'],
    }),
  },
  {
    key: 'customer',
    tag: 'Your customer',
    sub: 'Profiling your customer',
    q: 'In one line — who is your ideal customer?',
    type: 'short',
    placeholder: 'e.g. Seed-stage SaaS founders with a small team and no marketing hire',
    example: 'Busy salon owners running 2–5 chairs who hate admin.',
    ack: () => "Good — knowing exactly who we're for saves us both a lot of wasted work.",
    cluster: (a) => ({ id: 'customer', label: 'Customer', group: 'customer', leaves: splitLeaves(a, 2) }),
  },
  {
    key: 'revenue',
    tag: 'Your revenue',
    sub: 'Analysing your revenue',
    q: "Roughly, what's your monthly revenue right now? A range is completely fine.",
    type: 'short',
    placeholder: 'e.g. around ₹3–4L / month, mostly subscriptions',
    example: 'About $8k MRR, growing ~10% month over month.',
    ack: () => 'Thank you. That tells me what to push on now and what can wait.',
    cluster: (a) => ({ id: 'revenue', label: 'Revenue', group: 'revenue', leaves: [revenueStage(a).badge] }),
  },
  {
    key: 'goals',
    tag: 'Your goals',
    sub: 'Locking in your goals',
    q: 'What are your top 3 objectives for the next 6–12 months?',
    type: 'long',
    placeholder: '1. Hit ₹10L MRR\n2. Hire an ops lead\n3. Launch in two new cities',
    example: '1. Double paying customers\n2. Hire a first salesperson\n3. Get press in two industry outlets',
    ack: (a) => {
      const n = splitGoals(a).length;
      return n > 1
        ? `${n} things to aim at. I'll keep bringing us back to these.`
        : "That's the one to aim at. I'll keep bringing us back to it.";
    },
    cluster: (a) => ({ id: 'goals', label: 'Goals', group: 'goals', leaves: splitGoals(a).map((g) => shortLabel(g)) }),
  },
  {
    key: 'edge',
    tag: 'Your edge',
    sub: 'Finding your edge',
    q: 'Last one — what makes you different from your competitors?',
    type: 'long',
    placeholder: 'e.g. We are the only one that does same-day setup, and our support is human, not a bot…',
    example: "We're the only one built for solo operators — everyone else targets big teams.",
    ack: () => "That's everything I need. Give me a moment — I'm putting your company together.",
    cluster: (a) => ({ id: 'edge', label: 'Edge', group: 'edge', leaves: [shortLabel(a)] }),
  },
];

export const SYNTH_STEPS = [
  'Waking up your cofounder…',
  'Mapping your business',
  'Profiling your customer',
  'Analysing your revenue',
  'Locking in your goals',
  'Your AI cofounder is live ✦',
];

/* ============================================================
   Text handling
   ============================================================ */
const STOP = new Set(
  'the a an and or for to of in on with we our i you your is are be that this it they them their at by from as have has do does help make making build building using use used company business customer customers product products platform service services app tool tools people team small no not who what where when how one line month year 3 top objectives next 6 12'.split(
    /\s+/,
  ),
);

function words(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function titleCase(s: string) {
  return (s || '').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function shortLabel(s: string, n = 3) {
  const w = (s || '')
    .trim()
    .replace(/^[0-9]+[.)\-\s]+/, '')
    .split(/\s+/)
    .filter(Boolean);
  const out = w.slice(0, n).join(' ');
  return titleCase(out.length > 22 ? out.slice(0, 22) : out) || '—';
}

export function splitLeaves(s: string, n: number) {
  const parts = (s || '')
    .split(/[,/]| and | & /i)
    .map((x) => x.trim())
    .filter(Boolean);
  return (parts.length > 1 ? parts : [s]).slice(0, n).map((x) => shortLabel(x, 2));
}

export function splitGoals(s: string) {
  // prefer line/semicolon breaks; fall back to commas / "and"
  let parts = (s || '')
    .split(/\n|;/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    parts = (s || '')
      .split(/,|\band\b/i)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return parts
    .map((x) => x.replace(/^[0-9]+[.)\-]\s*/, '').trim()) // strip "1." / "2)" numbering
    .filter((x) => x.length > 1)
    .slice(0, 3);
}

/* ============================================================
   Reading the answers
   ============================================================ */
const CATEGORY = [
  { k: /market ?place/, cat: 'marketplace', word: 'Marketplace' },
  { k: /saas|software|dashboard|platform|api|b2b app/, cat: 'SaaS platform', word: 'Software' },
  { k: /fintech|payment|lending|bank|wallet|invoic|finance/, cat: 'fintech product', word: 'Fintech' },
  { k: /health|clinic|patient|care|wellness|therap/, cat: 'health product', word: 'Care' },
  { k: /edtech|education|course|learn|student|tutor/, cat: 'learning product', word: 'Learning' },
  { k: /agency|consult|studio|freelanc|done-for-you/, cat: 'services business', word: 'Craft' },
  {
    k: /d2c|dtc|ecommerce|e-commerce|store|shop|brand|retail|subscription box|apparel|coffee|food|beverage/,
    cat: 'consumer brand',
    word: 'Brand',
  },
  { k: /\bai\b|\bml\b|model|agent|automat/, cat: 'AI product', word: 'Intelligence' },
  { k: /content|media|newsletter|creator|publish/, cat: 'media product', word: 'Story' },
  { k: /community|network|social/, cat: 'community product', word: 'Community' },
  { k: /logistics|delivery|supply|warehouse|fleet/, cat: 'logistics business', word: 'Movement' },
];

export interface RevenueStage {
  badge: string;
  line: string;
}

export function revenueStage(s: string): RevenueStage {
  const t = (s || '').toLowerCase();
  const scale = (suf: string) =>
    /^(k|thousand)/.test(suf)
      ? 1e3
      : /^(l|lakh|lac)/.test(suf)
        ? 1e5
        : /^(m|mn|million)/.test(suf)
          ? 1e6
          : /^(cr|crore)/.test(suf)
            ? 1e7
            : 1;

  // 1) prefer a number attached to a scale suffix — take the last one so
  //    ranges like "3-4L" resolve to the upper, scaled figure
  let monthly: number | null = null;
  const scaleRe = /([0-9][0-9,.]*)\s*(crore|cr|lakh|lac|million|mn|thousand|k|l|m)\b/g;
  let sm: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((sm = scaleRe.exec(t))) last = sm;
  if (last) {
    monthly = parseFloat(last[1].replace(/,/g, '')) * scale(last[2]);
  } else {
    const cur = t.match(/[$₹]\s?([0-9][0-9,.]*)/); // 2) a currency figure
    if (cur) {
      monthly = parseFloat(cur[1].replace(/,/g, ''));
    } else {
      const bare = t.match(/\b([0-9][0-9,.]*)\b(?!\s*%)/); // 3) a bare number (not a percent)
      if (bare) monthly = parseFloat(bare[1].replace(/,/g, ''));
    }
  }

  const preWords =
    /\b(pre-?revenue|no revenue|not yet|none|nothing|zero|no sales|not making)\b/.test(t) || /[$₹]\s?0\b/.test(t);
  if (preWords || monthly === 0) {
    return { badge: 'Pre-revenue', line: "You're pre-revenue — so first moves are about proof and pipeline." };
  }
  if (monthly != null && monthly < 15000) {
    return { badge: 'Early revenue', line: 'Early revenue — the focus is repeatable growth without adding headcount.' };
  }
  if (monthly != null) {
    return { badge: 'Generating revenue', line: 'Revenue is flowing — Allya protects your time so you can compound it.' };
  }
  return { badge: 'Revenue underway', line: 'Revenue is flowing — Allya protects your time so you can compound it.' };
}

export interface Capability {
  dept: string;
  origin: 'agent' | 'expert';
  title: string;
  line: string;
  m: RegExp;
}

const CAP_LIB: Capability[] = [
  { dept: 'Marketing', origin: 'agent', title: 'Run your newsletter & campaigns', line: 'Drafted around your real wins, ready for your one-click approval.', m: /market|grow|brand|audience|launch|content|email|newsletter|awareness|reach/ },
  { dept: 'Marketing', origin: 'agent', title: 'Content calendar & SEO', line: 'A steady drumbeat of posts and pages that compound over time.', m: /content|seo|blog|social|traffic|inbound|awareness/ },
  { dept: 'Sales', origin: 'agent', title: 'Enrich & clean your CRM', line: 'Dedupe, enrich, and keep every lead current — automatically.', m: /sales|lead|crm|pipeline|revenue|convert|deal|customer|grow/ },
  { dept: 'Sales', origin: 'agent', title: 'Outbound to your ideal customer', line: 'Personalised sequences aimed at exactly the customer you described.', m: /sales|outbound|lead|pipeline|acquisition|convert|deal|grow|customer/ },
  { dept: 'Sales', origin: 'expert', title: 'Pipeline review with a sales expert', line: 'A real operator sanity-checks your funnel before you scale spend.', m: /sales|pipeline|revenue|scale|convert|deal/ },
  { dept: 'Hiring', origin: 'agent', title: 'Write JDs & screen candidates', line: 'Role scoped, sourced, and ranked against the JD you approve.', m: /hire|hiring|team|recruit|talent|ops lead|people|headcount|staff/ },
  { dept: 'Hiring', origin: 'expert', title: 'Shortlist review with a hiring expert', line: 'A specialist sits in on your top candidates and holds the slots.', m: /hire|hiring|recruit|team|talent|people/ },
  { dept: 'PR', origin: 'agent', title: 'Build a press list for your space', line: 'Journalists matched to your category, with angles that fit them.', m: /pr|press|media|coverage|launch|awareness|publicity|brand|journalist/ },
  { dept: 'PR', origin: 'expert', title: 'Pitch angles reviewed by a PR expert', line: 'A PR pro tightens the story before it ever reaches a reporter.', m: /pr|press|media|coverage|story|launch/ },
  { dept: 'Ops', origin: 'agent', title: 'Meeting notes & follow-ups', line: 'Every call captured, every action item chased down for you.', m: /ops|operation|process|admin|efficien|time|organi|workflow/ },
  { dept: 'Ops', origin: 'agent', title: 'SOPs & vendor tracking', line: 'Turn how you work into repeatable playbooks the team can run.', m: /ops|process|scale|sop|vendor|supply|logistics|efficien/ },
  { dept: 'Growth', origin: 'expert', title: 'Investor list & update drafts', line: 'A curated list and monthly updates, reviewed before they send.', m: /raise|invest|fund|seed|round|vc|capital|pitch deck/ },
];

function pickCapabilities(haystack: string) {
  const hay = haystack.toLowerCase();
  const chosen: Capability[] = [];
  const perDept: Record<string, number> = {};

  // matched first, capped at 2 per department
  CAP_LIB.filter((c) => c.m.test(hay)).forEach((c) => {
    perDept[c.dept] = perDept[c.dept] || 0;
    if (perDept[c.dept] < 2) {
      chosen.push(c);
      perDept[c.dept]++;
    }
  });
  // ensure spread + a minimum, filling with unmatched entries from new depts
  for (const c of CAP_LIB) {
    if (chosen.length >= 6) break;
    if (chosen.includes(c)) continue;
    if ((perDept[c.dept] || 0) >= 2) continue;
    chosen.push(c);
    perDept[c.dept] = (perDept[c.dept] || 0) + 1;
  }
  // guarantee at least one expert card (the honest 15%)
  if (!chosen.some((c) => c.origin === 'expert')) {
    const e = CAP_LIB.find((c) => c.origin === 'expert' && !chosen.includes(c));
    if (e) chosen[chosen.length - 1] = e;
  }
  return chosen.slice(0, 6);
}

function cleanCustomer(s: string) {
  const t = (s || '')
    .trim()
    .replace(/^(our|my)\s+(ideal\s+)?customers?\s*(is|are|:)?\s*/i, '')
    .replace(/\.$/, '');
  const lower = t ? t.charAt(0).toLowerCase() + t.slice(1) : 'founders like you';
  return { text: t || 'Founders like you', lower };
}

function firstSentence(s: string) {
  const m = (s || '').trim().split(/(?<=[.!?])\s/)[0];
  return (m || '').replace(/\.$/, '').trim();
}

function lowerFirst(s: string) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

export interface Derived {
  companyName: string;
  baseSeg: string;
  category: string;
  oneWord: string;
  customer: { text: string; lower: string };
  rev: RevenueStage;
  goalList: string[];
  edge: string;
  pitch: string;
  capabilities: Capability[];
}

export function derive(answers: Record<string, string>, companyName: string): Derived {
  const biz = answers.business || '';
  const edge = answers.edge || '';
  const goals = answers.goals || '';
  const market = answers.market || 'Both';
  const b2b = market === 'Businesses';
  const b2c = market === 'Consumers';
  const baseSeg = b2b ? 'B2B' : b2c ? 'B2C' : 'B2B + B2C';

  // category + the one word
  const hay = `${biz} ${edge}`.toLowerCase();
  const cat = CATEGORY.find((c) => c.k.test(hay)) || null;
  const category = cat ? cat.cat : b2c ? 'consumer business' : 'business';
  let oneWord = cat ? cat.word : '';
  if (!oneWord) {
    const freq: Record<string, number> = {};
    words(biz).forEach((w) => {
      if (w.length > 4 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
    });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    oneWord = top ? titleCase(top[0]) : 'Momentum';
  }

  const customer = cleanCustomer(answers.customer || '');
  const rev = revenueStage(answers.revenue || '');
  const goalList = splitGoals(goals);
  const edgeClean = firstSentence(edge);

  // elevator pitch — always coherent, always in their words
  const artA = /^[aeiou]/i.test(category) ? 'an' : 'a';
  let pitch = `${companyName || 'Your company'} is ${artA} ${category} for ${customer.lower}.`;
  if (edgeClean) pitch += ` What sets it apart: ${lowerFirst(edgeClean)}.`;

  return {
    companyName: companyName || 'Your company',
    baseSeg,
    category,
    oneWord,
    customer,
    rev,
    goalList,
    edge: edgeClean,
    pitch,
    capabilities: pickCapabilities(`${goals} ${biz} ${edge}`),
  };
}
