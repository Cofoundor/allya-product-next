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

export interface Surface {
  id: string;
  label: string;
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

export interface WorkAction {
  item: WorkItem;
  toast: string;
  reply: Reply;
}
