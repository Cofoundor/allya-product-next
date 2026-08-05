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
  audience: string;
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
}

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
