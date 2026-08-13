/* ============================================================
   The API contract, mirrored.

   These types are the TypeScript side of product-api/models.py. Nothing in
   here is invented by the frontend — if a field is missing, it belongs in
   the Pydantic model first.
   ============================================================ */

export type WorkStatus = 'needs-you' | 'running' | 'shipped';
export type Origin = 'agent' | 'expert';
export type Speaker = 'allya' | 'you' | 'human';
export type Period = 'today' | 'yesterday' | 'last-week';

export interface SurfaceSummary {
  id: string;
  label: string;
  note: string;
  href: string;
  /** the node in the company brain this surface hangs off */
  nodeId: string | null;
}

export interface BrainHeader {
  title: string;
  subtitle: string;
  backLabel: string | null;
  backHref: string | null;
}

export interface Lock {
  title: string;
  blurb: string;
  cta: string;
}

export interface Surface {
  id: string;
  label: string;
  /** false until this floor's own onboarding is done — it still renders */
  onboarded: boolean;
  lock: Lock | null;
  greeting: string;
  hint: string;
  placeholder: string;
  suggestions: string[];
  brain: BrainHeader;
  statusNoun: string;
  knowledgeTitle: string;
  scheduleTitle: string;
  /** group id → what that place is, read on a node's page */
  nodeCopy: Record<string, string>;
  emptyNeeds: string;
}

export interface BrainNodeDto {
  id: string;
  label: string;
  tier: number;
  group: string;
  parent: string | null;
  short: string | null;
  work: string | null;
  hidden: boolean;
  /** this node opens a surface of its own instead of a panel */
  surface: string | null;
  /** a placeholder until this floor's onboarding fills it in */
  provisional: boolean;
}

export interface BrainGraph {
  surfaceId: string;
  layout: 'web' | 'spray' | 'cluster';
  anchorId: string;
  nodes: BrainNodeDto[];
  links: [string, string][];
}

export interface User {
  id: string;
  email: string;
  name: string;
  company: string;
}

export interface Session {
  token: string;
  user: User;
}

/* ---- a floor's own onboarding ---- */

export interface ObCluster {
  id: string;
  label: string;
  group: string;
  /** 'answer' → split what was typed; 'fixed' → use `leaves` */
  leavesFrom: 'answer' | 'fixed';
  leaves: string[];
  maxLeaves: number;
}

export interface ObQuestion {
  key: string;
  tag: string;
  sub: string;
  q: string;
  type: 'short' | 'long' | 'choice';
  placeholder: string | null;
  example: string | null;
  options: string[];
  ack: string | null;
  ackByOption: Record<string, string>;
  learned: string;
  cluster: ObCluster;
}

export interface ServiceOnboarding {
  surfaceId: string;
  label: string;
  status: 'new' | 'complete';
  title: string;
  lede: string;
  cta: string;
  questions: ObQuestion[];
  synth: string[];
  doneTitle: string;
  doneLede: string;
  doneCta: string;
}

export interface OnboardingResult {
  surfaceId: string;
  status: 'complete';
  learned: string[];
}

/* ---- the instrument (design mock) ---- */

export interface InstrumentItem {
  id: string;
  label: string;
  /** meaning depends on the type — see the Pydantic model */
  at: number;
  lane: number;
  value: number;
  state: string;
  meta: string;
  /** who this dot is, when it stands for people — what makes it openable */
  personIds: string[];
}

export interface Instrument {
  surfaceId: string;
  type: 'timeline' | 'funnel' | 'ladder' | 'radar' | 'mass';
  title: string;
  caption: string;
  lanes: string[];
  unit: string;
  items: InstrumentItem[];
}

/* ---- a direction page (design mock) ---- */

export interface Stat {
  id: string;
  value: string;
  label: string;
  delta: string | null;
}

export interface Progress {
  label: string;
  value: number;
  of: number;
  note: string;
}

/** a campaign in a list: enough to rank it, not enough to read it */
export interface Send {
  id: string;
  subject: string;
  when: string;
  /** how the campaign says it out loud: "Signups who never opened" */
  audience: string;
  /** what that sentence resolves to. The audience stays prose because that's
      how a founder thinks about it; this is who actually gets the thing. */
  segmentId: string | null;
  sent: number;
  openRate: number;
  replies: number;
  state: 'sent' | 'scheduled' | 'draft';
  /** what it did, in its own words */
  outcome: string | null;
  /** the work item this campaign waits behind, if it waits on a human at
      all. One with it is pending, whatever its state says. */
  workId: string | null;
}

export interface DateFact {
  label: string;
  value: string;
}

/** one campaign, opened: the row, what it said, what it did and when.
    `kpis` is a list because what's worth showing depends on the state and
    on the channel — the page renders whatever comes back. */
export interface CampaignDetail extends Send {
  body: string[];
  ps: string | null;
  kpis: Stat[];
  dates: DateFact[];
}

/** everything the page needs to dress itself — no channel copy ships in
    the bundle, so a new channel is a backend change */
export interface ChannelUi {
  tint: string;
  /** the floor this direction hangs off, as the crumb and brain need it */
  floorLabel: string;
  floorHref: string;
  placeholder: string;
  suggestions: string[];
  knowTitle: string;
  brainTitle: string;
  brainSubtitle: string;
  backLabel: string;
  backHref: string;
  /** the lenses this page can be looked at through, when it has more than one */
  views?: ViewOption[];
}

/** a direction with a room of its own: which dots on a floor's brain are
    places you fly into, and where they go */
export interface DirectionSummary {
  id: string;
  label: string;
  href: string;
  surfaceId: string;
}

export type AnswerKey = 'audience' | 'point' | 'proof' | 'ask' | 'when';
export type Answers = Partial<Record<AnswerKey, string>>;

export interface Question {
  key: AnswerKey;
  tag: string;
  ask: string;
  /** 'answer' → the chip is the answer; 'starter' → it only opens the sentence */
  chipsAre: 'answer' | 'starter';
  options: string[];
}

/** a campaign written out of five answers, not yet created. (The review
    sheet's `Draft` is a different thing — an expert's revision.) */
export interface DraftCampaign {
  subjects: string[];
  preview: string;
  body: string[];
  ps: string | null;
  audience: string;
  when: string;
  rules: string[];
  next: string[];
}

export interface IdeaMove {
  id: string;
  label: string;
  /** empty on a brain thought; on a person, who can take this — an agent,
      an expert, or you. A move nobody can take is a label, and a page full
      of labels is a dashboard. */
  does: TouchBy[];
  /** how it reads in the work list once dispatched */
  workTitle: string;
  /** how it reads on your plate when you keep it */
  ownTitle: string;
}

/** the backend calls this `Move` and hands it back anywhere something offers
    you a next step — a thought on a brain, a person you've just opened */
export type Move = IdeaMove;

/** a thought on the channel's brain */
export interface Idea {
  id: string;
  label: string;
  note: string;
  state: 'live' | 'draft' | 'idea';
  moves: IdeaMove[];
  seed: string;
  work: string | null;
}

export interface Score {
  id: string;
  label: string;
  /** each channel says it its own way: "94", "Green", "1,000 / day" */
  value: string;
  state: 'good' | 'watch' | 'bad';
  note: string;
}

/** whether the channel itself is in good standing — deliverability for
    email, Meta's quality rating for WhatsApp */
export interface Health {
  title: string;
  blurb: string;
  scores: Score[];
  warmup: Progress | null;
  updates: string[];
}

/** a channel's own words, so one page can serve both without either
    having to speak the other's language */
export interface Nouns {
  one: string;
  many: string;
  metric: string;
  automations: string;
  audienceWord: string;
}

export interface Sequence {
  id: string;
  name: string;
  trigger: string;
  state: 'live' | 'off' | 'draft';
  audience: string;
  segmentId: string | null;
  stat: string;
}

/** A channel you can run campaigns on. Email was the first; WhatsApp is the
    same shape with its own words, its own health and its own limits. */
export interface EmailPage {
  id: string;
  surfaceId: string;
  label: string;
  blurb: string;
  stats: Stat[];
  progress: Progress | null;
  /** the one thing waiting on you, by work id */
  awaiting: string | null;
  sequences: Sequence[];
  notes: string[];
  health: Health | null;
  nouns: Nouns;
  ui: ChannelUi;
}

/** the name the page goes by now that it serves more than email */
export type ChannelPage = EmailPage;

/** everything the sign-in page renders, graph included */
export interface Gate {
  headline: string;
  lede: string;
  footnote: string;
  footnoteLinkLabel: string;
  footnoteLinkHref: string;
  brain: BrainGraph;
}

export interface WorkItem {
  id: string;
  surfaceId: string;
  status: WorkStatus;
  origin: Origin;
  who: string | null;
  whoName: string | null;
  whoRole: string | null;
  say: string | null;
  title: string | null;
  meta: string | null;
  undoable: boolean;
  /** who this is about. "CRM cleanup — merging 41 stale leads" is a claim
      about 41 records, and it should be openable, not only readable. */
  personId: string | null;
  segmentId: string | null;
}

export interface WorkSummary {
  shippedEarlier: number;
  spendLabel: string;
  spendNote: string;
}

export interface WorkList {
  items: WorkItem[];
  summary: WorkSummary;
}

export interface ReviewHead {
  avatar: string;
  human: boolean;
  who: string;
  role: string | null;
  line: string;
}

export interface TrailRow {
  kind: 'agent' | 'expert' | 'you';
  text: string;
  time: string | null;
}

export interface DiffPair {
  old: string;
  new: string;
}

export interface Draft {
  kicker: string;
  title: string;
  body: string;
  tags: string[];
}

export interface Review {
  workId: string;
  head: ReviewHead;
  trail: TrailRow[];
  diff: DiffPair[];
  drafts: Draft[];
  note: string | null;
  approveLabel: string;
}

export interface ApiMessage {
  id: string;
  speaker: Speaker;
  text: string;
  tag: string | null;
}

export interface ApiChip {
  label: string;
  /** "send" replays the label as a message; "review" opens a work item */
  action: 'send' | 'review';
  value: string;
}

export interface Reply {
  messages: ApiMessage[];
  chips: ApiChip[];
}

export interface Fact {
  id: string;
  surfaceId: string;
  text: string;
  period: Period;
  ts: number;
  flagged: boolean;
  mismatch: boolean;
  source: string;
  /** the person this is a fact about, when it's about one */
  personId: string | null;
}

export interface FactList {
  facts: Fact[];
}

export interface ScheduleEntry {
  id: string;
  when: string;
  what: string;
  pill: string | null;
  quiet: boolean;
}

export interface Schedule {
  entries: ScheduleEntry[];
}

/* ---- calendar ----
   The schedule said in prose; the calendar is the same company on a grid.
   An entry carrying a workId opens that item's approval sheet. */

export type CalendarKind = 'meeting' | 'ship' | 'review' | 'deadline' | 'focus';

export interface CalendarEvent {
  id: string;
  surfaceId: string;
  /** YYYY-MM-DD */
  date: string;
  /** "11:00", or "All day" */
  when: string;
  /** minutes past midnight; -1 is all-day, and sorts first */
  startMinute: number;
  durationMin: number;
  what: string;
  kind: CalendarKind;
  origin: Origin;
  pill: string | null;
  workId: string | null;
  /** who it's with. "Pipeline review — the 7 worth a call" is a meeting
      about seven people, and the grid should be able to open them. */
  personIds: string[];
}

export interface CalendarDay {
  date: string;
  count: number;
  needsYou: number;
  kinds: CalendarKind[];
}

export interface CalendarMonth {
  surfaceId: string;
  /** YYYY-MM */
  month: string;
  label: string;
  today: string;
  /** weekday the 1st falls on, Monday = 0 */
  firstWeekday: number;
  daysInMonth: number;
  /** only the days that hold something */
  days: CalendarDay[];
  selected: string;
}

export interface DayAgenda {
  surfaceId: string;
  date: string;
  label: string;
  events: CalendarEvent[];
  note: string | null;
}

export interface WorkAction {
  item: WorkItem;
  toast: string;
  reply: Reply;
}

/* ---- the people layer ----
   One record, whatever someone is to you. A journalist, a candidate and a
   lead are the same object with a different kind — which is what lets PR,
   hiring and sales stop keeping three lists of the same humans. */

export type PersonKind =
  | 'customer'
  | 'prospect'
  | 'journalist'
  | 'candidate'
  | 'investor'
  | 'partner';

export type TouchKind =
  | 'signup'
  | 'email'
  | 'whatsapp'
  | 'call'
  | 'meeting'
  | 'payment'
  | 'churn'
  | 'note'
  | 'press'
  | 'application'
  | 'stage'
  | 'import';

/** wider than Origin: on a person's timeline the founder's own moves belong
    next to the agent's, in the same grammar TrailRow already uses */
export type TouchBy = 'agent' | 'expert' | 'you';

export type Warmth = 'warm' | 'cooling' | 'cold' | 'never';
export type DealState = 'open' | 'won' | 'lost';
export type SourceState = 'connected' | 'available' | 'error';

export interface Stage {
  id: string;
  label: string;
  /** the lane index the instruments already encode with */
  at: number;
  kind: 'open' | 'won' | 'lost' | 'dormant';
  note: string;
}

/** the sales funnel, the hiring ladder and the press radar are this, with
    different stages and different geometry. `counts` arrives derived. */
export interface Pipeline {
  id: string;
  label: string;
  personKind: PersonKind;
  surfaceId: string;
  geometry: 'funnel' | 'ladder' | 'radar';
  /** what the geometry measures — the axis, not the tally */
  unit: string;
  /** what one row in a stage is called. Not the same thing: the press radar
      is measured in days and counted in people. */
  countNoun: string;
  stages: Stage[];
  counts: Record<string, number>;
  value: number | null;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  size: string | null;
  industry: string | null;
  stageId: string | null;
  peopleCount: number;
  value: number | null;
  note: string;
}

export interface Deal {
  id: string;
  personId: string | null;
  companyId: string | null;
  title: string;
  value: number;
  currency: string;
  pipelineId: string;
  stageId: string;
  state: DealState;
  opened: string;
  expectedClose: string | null;
  workId: string | null;
  note: string;
}

/** one thing that happened to one person — the journey's atom. `text` is
    already said the way it reads; nothing here composes a sentence. */
export interface Touch {
  id: string;
  personId: string;
  at: number;
  kind: TouchKind;
  by: TouchBy;
  text: string;
  who: string | null;
  channel: string | null;
  workId: string | null;
  campaignId: string | null;
  directionId: string | null;
  surfaceId: string | null;
}

export interface StageChange {
  at: number;
  fromId: string | null;
  toId: string;
  by: TouchBy;
  note: string;
}

export interface Journey {
  personId: string;
  name: string;
  touches: Touch[];
  stages: StageChange[];
  opened: string;
  note: string;
}

/** where someone came from, at the grain a founder decides on. Not "the
    site" — which post, which story, whose referral. */
export type Channel =
  | 'site'
  | 'email'
  | 'whatsapp'
  | 'press'
  | 'social'
  | 'referral'
  | 'job-boards'
  | 'csv'
  | 'direct';

export interface TouchPoint {
  at: number;
  channel: Channel;
  /** the answer written out — "The SurferSearcher story" */
  said: string;
  campaignId: string | null;
  directionId: string | null;
  surfaceId: string | null;
}

/** first touch answers "where do leads come from"; last touch answers the
    more expensive question — what actually closes them */
export interface Attribution {
  first: TouchPoint | null;
  last: TouchPoint | null;
  path: TouchPoint[];
  convertedAt: number | null;
  daysToConvert: number | null;
  note: string;
}

/** one thing worth doing now, and the move that does it. A founder opening
    a book of a hundred strangers needs a decision, not a report. */
export interface Prompt {
  id: string;
  personId: string | null;
  name: string;
  /** why this one, in her voice */
  why: string;
  moveId: string | null;
  moveLabel: string;
  does: TouchBy[];
  urgency: 'late' | 'today' | 'soon' | 'idea';
}

/** one door in, and what came through it. `rate` is the number a founder
    decides on — the channel that brings the most rarely converts best.
    Named OriginStat because `Origin` already means agent-or-expert. */
export interface OriginStat {
  id: Channel;
  said: string;
  count: number;
  worth: number;
  paying: number;
  rate: number;
}

/** something owed, and when by. A contact list says who exists; this is
    what makes it a CRM — it can go overdue. */
export interface Followup {
  id: string;
  personId: string;
  what: string;
  /** YYYY-MM-DD */
  due: string;
  by: TouchBy;
  state: 'open' | 'done' | 'snoozed';
  created: string;
  workId: string | null;
}

/** what taking a move produced: a work item if it was dispatched, a
    follow-up if you kept it */
export interface MoveResult {
  work: WorkItem | null;
  followup: Followup | null;
  touch: Touch;
  toast: string;
}

export interface Person {
  id: string;
  name: string;
  kinds: PersonKind[];
  email: string | null;
  phone: string | null;
  handle: string | null;
  companyId: string | null;
  pipelineId: string;
  stageId: string;
  warmth: Warmth;
  source: string;
  /** who has been working them — the 85/15 seam, on the customer record */
  owner: TouchBy;
  tags: string[];
  value: number | null;
  created: string;
  lastTouchAt: number | null;
  /** Allya's one-line read, in her voice */
  note: string;
  /** what brought them, short enough for a row */
  originSaid: string;
  originChannel: Channel | null;
  /** what's owed and when — derived from the open follow-ups, so a list can
      be sorted by who's actually late without opening anybody */
  nextStep: string | null;
  nextDue: string | null;
  overdue: boolean;
}

export interface PersonDetail extends Person {
  company: Company | null;
  deals: Deal[];
  touches: Touch[];
  segments: string[];
  facts: string[];
  next: Move[];
  attribution: Attribution;
  followups: Followup[];
}

/** a person as a row in the grid. The record alone doesn't carry what a
    column needs — a company's name, what's on the table, how many times
    anyone has spoken to them — and a request per row is not an answer. */
export interface PersonRow extends Person {
  companyName: string;
  companySize: string;
  companyIndustry: string;
  /** what they appear to be after — an inference, never shown without its
      reason, because a read a founder can't check is one they shouldn't trust */
  intent: string;
  intentWhy: string;
  /** money still open against them, across every deal */
  openValue: number;
  dealCount: number;
  segmentLabels: string[];
  touchCount: number;
  /** the most recent thing that happened, in its own words */
  lastSaid: string;
  daysInStage: number | null;
  /** who owes the next step, when something is owed */
  nextBy: TouchBy | null;
}

/** one lens on the book — the header switch is drawn from these */
export interface ViewOption {
  id: string;
  label: string;
  note: string;
}

/** One column the grid can show. `key` names a field on a person row, which
    is what lets the client render a column it has never heard of. Width is
    absent on purpose: how wide a column sits on a screen is the client's
    business, not the contract's. */
export interface TableColumn {
  key: string;
  label: string;
  group: string;
  on: boolean;
  num: boolean;
  wide: boolean;
}

/** a named set of columns — per-user saved views replace this list without
    the client changing */
export interface TablePreset {
  id: string;
  label: string;
  note: string;
  keys: string[];
}

export interface TableSpec {
  columns: TableColumn[];
  presets: TablePreset[];
  groups: string[];
}

export interface WarmthWord {
  id: Warmth;
  /** how it reads in a column: "this week" */
  said: string;
  /** the same fact with room to breathe, for a record: "spoken to this week" */
  saidFull: string;
  /** warmest first — sorting reads this rather than inventing an order */
  rank: number;
}

export interface DispatchWord {
  id: TouchBy;
  verb: string;
  note: string;
}

/** The words the interface puts on this API's enums. Every one of these used
    to be a constant in a component, which is how the warmth vocabulary ended
    up spelled three different ways on three different screens. */
export interface Lexicon {
  warmth: WarmthWord[];
  touchKinds: Record<string, string>;
  urgency: Record<string, string>;
  dispatch: DispatchWord[];
  experts: Record<string, string>;
}

export interface PersonList {
  people: PersonRow[];
  total: number;
  cursor: string | null;
  caption: string;
}

export interface SegmentRule {
  /** a hand-picked list rather than a rule. Every CRM has both, and they
      answer different questions: a rule stays true as people move, a list
      stays exactly who you chose. Set this and nothing else applies. */
  personIds: string[];
  kinds: PersonKind[];
  stageIds: string[];
  warmth: Warmth[];
  tags: string[];
  sources: string[];
  notTouchedDays: number | null;
  touchedKind: TouchKind | null;
  neverKind: TouchKind | null;
}

/** what `audience` used to be a sentence about */
export interface Segment {
  id: string;
  label: string;
  rule: SegmentRule;
  count: number;
  live: boolean;
  note: string;
}

export interface DupeRow {
  row: number;
  incoming: string;
  existingId: string;
  existing: string;
  matchedOn: 'email' | 'phone' | 'handle' | 'name';
  keep: string;
}

export interface ImportPreview {
  columns: string[];
  /** column heading -> the field we think it is */
  mapping: Record<string, string>;
  rowsTotal: number;
  rowsReady: number;
  duplicates: DupeRow[];
  problems: string[];
  sample: Record<string, string>[];
}

export interface ImportResult {
  added: number;
  merged: number;
  skipped: number;
  segmentId: string | null;
  learned: string[];
}

export interface IngestResult {
  personId: string;
  created: boolean;
  touchId: string;
  stageId: string;
  note: string;
}

export interface Source {
  id: string;
  label: string;
  state: SourceState;
  blurb: string;
  lastSync: string | null;
  count: number | null;
  note: string;
}

/** the layer, dressed. Same shape as a channel page on purpose. */
export interface CrmPage {
  id: string;
  label: string;
  blurb: string;
  stats: Stat[];
  progress: Progress | null;
  awaiting: string | null;
  pipelines: Pipeline[];
  segments: Segment[];
  sources: Source[];
  notes: string[];
  nouns: Nouns;
  ui: ChannelUi;
}
