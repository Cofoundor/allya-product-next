/* ============================================================
   Workspace seed data — the work panel is data-driven; it's the
   visible proof this is a tool and not a landing page.
   ============================================================ */

import type { NodeSpec } from './brain';

export type WorkStatus = 'needs-you' | 'running' | 'shipped';
export type Origin = 'agent' | 'expert';

export interface WorkItem {
  id: string;
  status: WorkStatus;
  origin: Origin;
  /** needs-you cards speak in Allya's (or an expert's) voice */
  who?: string;
  whoName?: string;
  whoRole?: string;
  say?: string;
  /** running / shipped rows are terse */
  title?: string;
  meta?: string;
  undoable?: boolean;
}

export const INITIAL_WORK: WorkItem[] = [
  {
    id: 'newsletter',
    status: 'needs-you',
    origin: 'expert',
    who: 'A',
    whoName: 'Allya',
    whoRole: 'with your PR expert',
    say: 'Next week’s newsletter is drafted around the SurferSearcher result. Your PR expert’s edits are in. Read it before it ships?',
  },
  {
    id: 'leads',
    status: 'running',
    origin: 'agent',
    title: 'Enriching 40 leads from last week’s signups',
    meta: 'agent · ~8 min left',
  },
  {
    id: 'screening',
    status: 'running',
    origin: 'agent',
    title: 'Screening 6 candidates for the ops role',
    meta: 'agent · ranking against your approved JD',
  },
  {
    id: 'press',
    status: 'running',
    origin: 'expert',
    title: 'Press list — 22 journalists, matched to your space',
    meta: 'expert · final pass',
  },
  {
    id: 'crm',
    status: 'shipped',
    origin: 'agent',
    title: 'CRM cleanup — 41 stale leads merged, 12 archived',
    meta: '6:40am · sales expert spot-checked',
  },
  {
    id: 'jd',
    status: 'shipped',
    origin: 'agent',
    title: 'Ops-hire JD written and posted to three boards',
    meta: '7:15am · 6 already through first screen',
  },
];

export const DAY_PLAN = [
  { time: '11:00', what: 'Investor call — Meridian', pill: 'notes ready' },
  { time: '15:00', what: 'Ops interview — Ananya R.', pill: 'brief ready' },
  { time: '—', what: 'Nothing else. I kept your afternoon clear on purpose.', quiet: true },
];

export const SUGGESTIONS = [
  'Draft next week’s newsletter',
  'Where’s the ops hire?',
  'Clean up my CRM again this week',
];

/* ---- the brain's graph: your company, its departments, and the concrete
   things under them. Some ids mirror a WORK item so the node breathes when
   that work needs your eyes. ---- */
export const BRAIN_NODES: NodeSpec[] = [
  { id: 'co', label: 'Your company', tier: 0, group: 'core' },
  { id: 'marketing', label: 'Marketing', tier: 1, group: 'marketing', parent: 'co' },
  { id: 'hiring', label: 'Hiring', tier: 1, group: 'hiring', parent: 'co' },
  { id: 'pr', label: 'PR', tier: 1, group: 'pr', parent: 'co' },
  { id: 'sales', label: 'Sales', tier: 1, group: 'sales', parent: 'co' },
  { id: 'ops', label: 'Ops', tier: 1, group: 'ops', parent: 'co' },

  { id: 'newsletter', label: 'Draft the newsletter', tier: 2, group: 'marketing', parent: 'marketing', work: 'newsletter' },
  { id: 'campaigns', label: 'Reel: the day-one story', tier: 2, group: 'marketing', parent: 'marketing' },
  { id: 'seo', label: 'Own “fast”, not “cheap”', tier: 2, group: 'marketing', parent: 'marketing' },
  { id: 'social', label: 'LinkedIn: the pivot lesson', tier: 2, group: 'marketing', parent: 'marketing' },
  { id: 'content', label: 'Cut the demo into shorts', tier: 2, group: 'marketing', parent: 'marketing' },

  { id: 'candidates', label: '6 candidates to screen', tier: 2, group: 'hiring', parent: 'hiring', work: 'screening' },
  { id: 'jd', label: 'Hire a designer first', tier: 2, group: 'hiring', parent: 'hiring', work: 'jd' },
  { id: 'interviews', label: 'Add a founder round', tier: 2, group: 'hiring', parent: 'hiring' },
  { id: 'onboarding', label: 'Day-one checklist', tier: 2, group: 'hiring', parent: 'hiring' },

  { id: 'presslist', label: 'Refresh the press list', tier: 2, group: 'pr', parent: 'pr', work: 'press' },
  { id: 'journalists', label: '3 reporters to warm up', tier: 2, group: 'pr', parent: 'pr' },
  { id: 'pitches', label: 'Pitch the pivot story', tier: 2, group: 'pr', parent: 'pr' },
  { id: 'coverage', label: 'Follow up: TechCrunch', tier: 2, group: 'pr', parent: 'pr' },

  { id: 'leads', label: '7 warm leads to call', tier: 2, group: 'sales', parent: 'sales', work: 'leads' },
  { id: 'crm', label: 'Clean up the CRM', tier: 2, group: 'sales', parent: 'sales', work: 'crm' },
  { id: 'pipeline', label: 'Push referrals next', tier: 2, group: 'sales', parent: 'sales' },
  { id: 'outreach', label: 'Win back churned users', tier: 2, group: 'sales', parent: 'sales' },

  { id: 'calendar', label: 'Protect deep-work Fridays', tier: 2, group: 'ops', parent: 'ops' },
  { id: 'docs', label: 'Write the pricing memo', tier: 2, group: 'ops', parent: 'ops' },
  { id: 'finance', label: 'Test annual pricing', tier: 2, group: 'ops', parent: 'ops' },
  { id: 'vendors', label: 'Cut hosting costs', tier: 2, group: 'ops', parent: 'ops' },
];

/** cross-links weave the tree into a web */
export const BRAIN_CROSS: [string, string][] = [
  ['leads', 'campaigns'],
  ['journalists', 'presslist'],
  ['pipeline', 'crm'],
  ['calendar', 'candidates'],
  ['social', 'content'],
  ['outreach', 'leads'],
  ['coverage', 'journalists'],
  ['finance', 'pipeline'],
  ['onboarding', 'docs'],
  ['pitches', 'campaigns'],
  ['seo', 'content'],
  ['interviews', 'calendar'],
];
