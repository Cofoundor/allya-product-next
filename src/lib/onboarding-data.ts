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

export const MINI_SYNTH_STEPS = [
  'Building your brain…',
  'Mapping what I know…',
  'Brain ready ✦',
];

export const SYNTH_STEPS = [
  'Waking up your cofounder…',
  'Mapping your business',
  'Profiling your customer',
  'Analysing your revenue',
  'Locking in your goals',
  'Your AI cofounder is live ✦',
];

/* beats slow toward the end so the finale builds rather than lists */
export const SYNTH_HOLD = [620, 700, 780, 860, 940, 1100];

/* ============================================================
   MCQ Questions (shown after the showcase)
   ============================================================ */

export interface McqQuestion {
  id: string;
  title: string;
  question: string;
  answers: string[];
  multiSelect?: boolean;
  bifurcation?: {
    b2cQuestion: string;
    b2cAnswers: string[];
    b2bQuestion: string;
    b2bAnswers: string[];
  };
}

export const MCQ_QUESTIONS: McqQuestion[] = [
  {
    id: '6',
    title: 'nature_of_business',
    question: 'Which of these best describes the nature of your business?',
    answers: [
      'B2C (You sell directly to consumers)',
      'D2C (Digitally native brand that manufactures and sells directly)',
      'B2B (You sell to other businesses)',
      'B2G (You sell to government or public institutions)',
      'Marketplace (You connect buyers and sellers or service providers)',
      'Content-based business (e.g. blogs, newsletters, video channels, etc.)',
      'Community-led business (monetizing or supporting a user/member group)',
      'NGO / Social Impact initiative',
      'Financial / Insurance / Investment Business (e.g. NBFCs, insurers, funds)',
      'Franchise / Licensing Business (you license a brand/process to others)',
      'Affiliate / Referral Monetization (e.g. affiliate networks, coupon sites)',
      'Open-source or Community-funded Project (with free core offering)',
      'Events / Venue / Experience-based Business (e.g. concerts, weddings)',
      'Real Estate / Property Business (e.g. developers, brokers, rental income)',
      'Supply Chain / Logistics / Transport Services (e.g. freight, warehousing)',
      'Research, Lab, or Technical Testing Services (e.g. biotech, analytics labs)',
      'Regulated / Government Contracting (e.g. infra, defense, PPPs)',
      'Infrastructure / Utilities / Telecom / Cloud Services',
      'Other / Still Figuring It Out',
    ],
    multiSelect: true,
  },
  {
    id: '7',
    title: 'business_offering',
    question: 'What do you primarily offer or deliver?',
    answers: [
      'Physical products',
      'Digital products',
      'Software or SaaS tool',
      'One-time services',
      'Ongoing or monthly services',
      'Platform or marketplace commissions',
      'Memberships / subscriptions / paid communities',
      'Ad-supported content',
      'Freemium model',
      'Event space or time-based booking',
      'Licensing, brokerage, or leasing',
      'Data, research, or testing outcomes',
      'Infrastructure access or system uptime',
      'Other',
    ],
    multiSelect: true,
  },
  {
    id: '8',
    title: 'business_stage',
    question: 'What stage is your business currently at?',
    answers: [
      'Just an idea',
      'Validated idea',
      'MVP or early version is live',
      'Fully launched',
      'Revenue-generating',
      'Growing steadily and scaling operations',
    ],
  },
  {
    id: '9',
    title: 'monetization_status',
    question: 'Are you monetizing anything right now?',
    answers: [
      'No, not yet monetizing',
      'Testing monetization with a few early users',
      'Selling or earning actively but still early-stage',
      'Monetization is stable or growing',
      'Monetization is not the goal at this stage',
    ],
  },
  {
    id: '10',
    title: 'operational_needs',
    question: 'Are you currently managing any of the following areas?',
    answers: [
      'Inventory or product fulfillment',
      'Recurring billing / subscription payments',
      'Client onboarding or project servicing',
      'Product / app / platform development',
      'Paid promotions / advertising / affiliate campaigns',
      'Community engagement or moderation',
      'Hiring or team coordination',
      'Lead generation or CRM tracking',
      'Event, space, or calendar bookings',
      'Regulatory, licensing, or compliance workflows',
      'Other operational needs',
    ],
    multiSelect: true,
  },
  {
    id: '11',
    title: 'target_audience',
    question: 'Who is your primary target audience?',
    answers: [
      'Consumers',
      'Businesses',
      'Institutions',
      'Professionals',
      'Communities or groups',
      'Still figuring it out',
    ],
  },
  {
    id: '12',
    title: 'audience_profile_1',
    question: "What best describes your audience's age group?",
    answers: ['Teenagers', 'Young Adults', 'Adults', 'Mid-career', 'Seniors'],
    multiSelect: true,
  },
  {
    id: '13',
    title: 'audience_profile_2',
    question: "What best describes your audience's geography?",
    answers: ['Urban', 'Tier 2/3 towns', 'Rural/Semi-urban', 'International'],
    multiSelect: true,
  },
  {
    id: '14',
    title: 'audience_profile_3',
    question: "What best describes your audience's language preference?",
    answers: ['English', 'Hindi', 'Hinglish', 'Other'],
    multiSelect: true,
  },
  {
    id: '15',
    title: 'audience_profile_4',
    question: "What best describes your audience's device usage?",
    answers: ['Mobile', 'Desktop/Laptop', 'Both equally'],
    multiSelect: true,
  },
  {
    id: '16',
    title: 'buying_role',
    question: 'What role does your audience play in the buying decision?',
    answers: [
      'They are the user AND the buyer',
      'They are the buyer but not the user',
      'They are influencers',
      'Still unclear',
    ],
  },
  {
    id: '17',
    title: 'audience_motivation',
    question: 'What motivates your audience to buy or engage?',
    answers: [
      'Price or affordability',
      'Aspirational lifestyle / image',
      'Convenience or time-saving',
      'FOMO',
      'Expert credibility or trust',
      'Community belonging',
      'Functional outcome / need',
      'Still figuring this out',
    ],
    multiSelect: true,
  },
  {
    id: '18',
    title: 'purchase_details_or_organizational_size',
    question: '',
    answers: [],
    bifurcation: {
      b2cQuestion: 'Who is the primary purchaser?',
      b2cAnswers: ['End-user', 'Parent', 'Household decision-maker', 'Gift-giver', 'Group or shared decision', 'Other'],
      b2bQuestion: 'What is the Organization Size?',
      b2bAnswers: ['1-5', '6-20', '21-100', '101-500', '500+'],
    },
  },
  {
    id: '19',
    title: 'decision_maker_or_product_users',
    question: '',
    answers: [],
    bifurcation: {
      b2cQuestion: 'Who ultimately decides to buy?',
      b2cAnswers: ['Spontaneous decision', 'Family discussion', 'Research-driven', 'Promo-triggered', 'Peer influence'],
      b2bQuestion: 'Who uses the product/service?',
      b2bAnswers: ['End-users', 'Admins', 'Managers', 'Mixed teams'],
    },
  },
  {
    id: '20',
    title: 'purchase_or_decision_influencers',
    question: '',
    answers: [],
    bifurcation: {
      b2cQuestion: 'Who influences the purchase?',
      b2cAnswers: ['Friends', 'Influencers', 'Reviews', 'Brand community', 'In-store staff', 'Other'],
      b2bQuestion: 'Who influences the decision?',
      b2bAnswers: ['End-users', 'Technical evaluators', 'Finance team', 'Operations team', 'Sales team', 'External consultants'],
    },
  },
  {
    id: '21',
    title: 'decision_cycle_or_process',
    question: '',
    answers: [],
    bifurcation: {
      b2cQuestion: "What's the typical decision cycle?",
      b2cAnswers: ['Impulse', 'Quick', 'Considered', 'Major purchase decision'],
      b2bQuestion: 'How is a decision made?',
      b2bAnswers: ['Solo', 'Small group', 'Large committee', 'Community vote'],
    },
  },
  {
    id: '22',
    title: 'purchase_drivers_or_role_priorities',
    question: '',
    answers: [],
    bifurcation: {
      b2cQuestion: 'Who are the key purchase drivers by role?',
      b2cAnswers: ['End-user', 'Household / family', 'Gift-giver', 'Influencer (social or peer)'],
      b2bQuestion: 'What is the role-specific priority?',
      b2bAnswers: ['Buyer', 'End-user', 'Technical evaluator', 'Influencer'],
    },
  },
  {
    id: '23',
    title: 'price_tier',
    question: 'Which price/value tier best describes your brand?',
    answers: ['Mass market / Budget-friendly', 'Mid-market / Affordable quality', 'Premium', 'Luxury', 'Ultra-luxury'],
  },
  {
    id: '24',
    title: 'brand_personality',
    question: 'Which three brand personality traits resonate most with you?',
    answers: [
      'Friendly & Approachable',
      'Bold & Disruptive',
      'Elegant & Sophisticated',
      'Fun & Playful',
      'Trustworthy & Reliable',
      'Minimalist & Clean',
      'Innovative & Cutting-edge',
      'Ethical & Sustainable',
    ],
    multiSelect: true,
  },
  {
    id: '25',
    title: 'brand_voice',
    question: 'What tone & voice should we adopt for your brand?',
    answers: ['Casual', 'Professional', 'Witty', 'Inspirational', 'Direct', 'Empathetic'],
  },
  {
    id: '26',
    title: 'key_metrics',
    question: 'Which of these supporting metrics matter to you?',
    answers: ['Website traffic', 'Email growth', 'Conversion rate', 'AOV', 'LTV', 'CAC', 'Margin', 'MAU/DAU', 'Churn', 'NPS'],
    multiSelect: true,
  },
  {
    id: '27',
    title: 'feedback',
    question: 'What feedback have you received so far?',
    answers: ['Testimonials', 'Survey responses', 'Informal feedback', 'No feedback yet'],
  },
  {
    id: '28',
    title: 'team_size',
    question: 'How big is your current team?',
    answers: ['Solo founder', '2-5 people', '6-20', '21-50', '50+'],
  },
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

function clip(s: string, n = 9) {
  const w = (s || '').trim().replace(/\.$/, '').split(/\s+/);
  return w.length > n ? `${w.slice(0, n).join(' ')}…` : w.join(' ');
}

/* "We're the only X" → "the only X", so it reads inside our own sentence */
function deSubject(s: string) {
  return (s || '').trim().replace(/^(we(?:'| a)re|we have|we|our|i(?:'m| am))\s+/i, '');
}

/* Every capability card names something the founder actually said — the
   customer, a goal, their edge — so nothing on the showcase reads generic.
   `seen` counts prior cards in the same department so two Sales cards don't
   come out word-for-word identical. */
export function personalise(c: Capability, d: Derived, seen = 0) {
  const cust = clip(d.customer.lower, 8);
  const g1 = d.goalList[0] ? lowerFirst(clip(d.goalList[0], 7)) : null;
  const g2 = d.goalList[1] ? lowerFirst(clip(d.goalList[1], 7)) : null;
  const edge = d.edge ? lowerFirst(clip(deSubject(d.edge), 9)) : null;
  switch (c.dept) {
    case 'Marketing':
      return seen === 0
        ? `Written for ${cust}${edge ? `, leading with ${edge}` : ''}.`
        : `A steady drumbeat aimed at ${cust}.`;
    case 'Sales':
      return seen === 0
        ? `Aimed at ${cust}${g1 ? ` — pointed at ${g1}` : ''}.`
        : seen === 1
          ? `Sequences written for ${cust}, in your voice.`
          : `A real operator pressure-tests the funnel behind ${g1 || 'your growth'}.`;
    case 'Hiring':
      return seen === 0
        ? g2 || g1
          ? `Scoped against your goal to ${g2 || g1}.`
          : `Scoped to the team ${d.companyName} needs next.`
        : `A specialist sits in on the shortlist for ${d.companyName}.`;
    case 'PR':
      return seen === 0
        ? `Journalists who cover the ${d.category} space, pitched on ${edge || 'what makes you different'}.`
        : 'Your story tightened before it reaches a reporter.';
    case 'Ops':
      return seen === 0
        ? `Built around how ${d.companyName} already works — not a template.`
        : 'Your way of working, turned into playbooks the next hire can run.';
    case 'Growth':
      return `Framed around ${d.rev.badge.toLowerCase()} and where you're taking it.`;
    default:
      return c.line;
  }
}

/* Which cluster each MCQ speaks to — a pill toggle sends a thought there so
   the brain visibly reacts even when the answer doesn't spawn a node. */
export const MCQ_CLUSTER: Record<string, string> = {
  '6': 'business', '7': 'business', '8': 'revenue', '9': 'revenue', '10': 'business',
  '11': 'customer', '12': 'customer', '13': 'customer', '14': 'customer', '15': 'customer',
  '16': 'customer', '17': 'customer', '18': 'customer', '19': 'customer', '20': 'customer',
  '21': 'customer', '22': 'customer', '23': 'revenue', '24': 'edge', '25': 'edge',
  '26': 'goals', '27': 'market', '28': 'business',
};

/* Single-choice questions that plant a labelled leaf in the brain — changing
   the answer relabels that same leaf, deselecting removes it. */
export const MCQ_BRAIN: Record<string, { cluster: string; slot: string; short: (a: string) => string }> = {
  '8': { cluster: 'revenue', slot: 'stage', short: (a) => shortLabel(a, 3) },
  '11': { cluster: 'customer', slot: 'aud', short: (a) => shortLabel(a, 2) },
  '16': { cluster: 'customer', slot: 'role', short: (a) => shortLabel(a, 3) },
  '23': { cluster: 'revenue', slot: 'price', short: (a) => shortLabel(a, 2) },
  '25': { cluster: 'edge', slot: 'voice', short: (a) => a },
};

const uniq = (a: string[]) => [...new Set(a)];

/* Prefill the MCQs from what the founder already told us in the chat, so the
   page opens already answered and they only correct what's wrong. */
export function computePrefill(d: Derived, market: string): Record<string, string | string[]> {
  const pf: Record<string, string | string[]> = {};
  const isB2B = market === 'Businesses';
  const cat = (d.category || '').toLowerCase();
  const badge = d.rev.badge;

  const nb: string[] = [];
  if (market === 'Businesses') nb.push('B2B (You sell to other businesses)');
  else if (market === 'Consumers') nb.push('B2C (You sell directly to consumers)');
  else nb.push('B2C (You sell directly to consumers)', 'B2B (You sell to other businesses)');
  if (/consumer brand|d2c|dtc/.test(cat)) nb.push('D2C (Digitally native brand that manufactures and sells directly)');
  if (/marketplace/.test(cat)) nb.push('Marketplace (You connect buyers and sellers or service providers)');
  if (/media|content|story/.test(cat)) nb.push('Content-based business (e.g. blogs, newsletters, video channels, etc.)');
  if (/community/.test(cat)) nb.push('Community-led business (monetizing or supporting a user/member group)');
  pf['6'] = uniq(nb);

  const off: string[] = [];
  if (/saas|software/.test(cat)) off.push('Software or SaaS tool');
  if (/consumer brand|d2c|retail|brand/.test(cat)) off.push('Physical products');
  if (/services|agency|consult|craft/.test(cat)) off.push('Ongoing or monthly services');
  if (/media|content|story/.test(cat)) off.push('Ad-supported content');
  if (/marketplace/.test(cat)) off.push('Platform or marketplace commissions');
  if (!off.length) off.push('Digital products');
  pf['7'] = uniq(off);

  pf['8'] = badge === 'Pre-revenue' ? 'MVP or early version is live'
    : badge === 'Early revenue' ? 'Revenue-generating'
      : 'Growing steadily and scaling operations';
  pf['9'] = badge === 'Pre-revenue' ? 'No, not yet monetizing'
    : badge === 'Early revenue' ? 'Selling or earning actively but still early-stage'
      : 'Monetization is stable or growing';
  pf['10'] = ['Lead generation or CRM tracking', 'Hiring or team coordination', 'Paid promotions / advertising / affiliate campaigns'];
  pf['11'] = isB2B ? 'Businesses' : 'Consumers';
  pf['15'] = ['Mobile'];
  pf['16'] = isB2B ? 'They are the buyer but not the user' : 'They are the user AND the buyer';
  pf['23'] = 'Mid-market / Affordable quality';
  pf['25'] = isB2B ? 'Professional' : 'Casual';
  pf['28'] = 'Solo founder';
  return pf;
}

/* Concrete proof that Allya was listening — each row quotes their input. */
export function knowledgeNotes(d: Derived) {
  const out: { k: string; v: string }[] = [
    { k: 'Who you serve', v: d.customer.text },
    { k: 'Your stage', v: d.rev.badge },
  ];
  if (d.edge) out.push({ k: 'Your edge', v: d.edge });
  out.push({
    k: 'How you sell',
    v:
      d.baseSeg === 'B2B'
        ? 'To other businesses — longer cycles, fewer, bigger deals'
        : d.baseSeg === 'B2C'
          ? 'Direct to consumers — volume and voice matter most'
          : 'Both business and consumer — I keep two tones ready',
  });
  out.push({ k: 'What you call it', v: titleCase(d.category) });
  d.goalList.forEach((g, i) => out.push({ k: `Goal ${i + 1}`, v: g }));
  return out;
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
