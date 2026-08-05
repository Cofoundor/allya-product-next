/* ============================================================
   The gate, without a backend.

   The sign-in page is the way in, so it can't be the one page that
   goes blank when /gate is unreachable — a deploy whose API isn't up
   yet still has to look like the vanilla gate it was ported from.

   This mirrors GATE / GATE_BRAIN_NODES in product-api's data.py and
   the SPEC / CROSS in product/login.js. If the copy or the graph
   changes there, change it here too.
   ============================================================ */

import type { NodeSpec } from './brain';

const leaves = (prefix: string, group: string, parent: string, labels: string[]): NodeSpec[] =>
  labels.map((label, i) => ({ id: `${prefix}${i + 1}`, label, tier: 2, group, parent }));

/* the company as an outsider meets it — not the workspace's departments */
export const GATE_NODES: NodeSpec[] = [
  { id: 'co', label: 'ZeroTo10', tier: 0, group: 'core' },
  { id: 'product', label: 'Product', tier: 1, group: 'product', parent: 'co' },
  ...leaves('p', 'product', 'product', ['Allya', 'Agents', 'Experts', 'Onboarding']),
  { id: 'market', label: 'Market', tier: 1, group: 'market', parent: 'co' },
  ...leaves('m', 'market', 'market', ['Who it is for', 'Market size', 'Competition']),
  { id: 'traction', label: 'Traction', tier: 1, group: 'traction', parent: 'co' },
  ...leaves('t', 'traction', 'traction', ['Stage', 'Proof', 'Roadmap']),
  { id: 'model', label: 'Model', tier: 1, group: 'model', parent: 'co' },
  ...leaves('o', 'model', 'model', ['Pricing', 'Unit economics', 'Go-to-market']),
  { id: 'team', label: 'Team', tier: 1, group: 'team', parent: 'co' },
  ...leaves('e', 'team', 'team', ['Founders', 'Origin']),
];

/* three strands that skip the hub — the graph reads as a business, not a
   filing cabinet: what you sell prices itself, what you've proven is what
   the market rewarded, and the model is what the traction pays for */
export const GATE_LINKS: [string, string][] = [
  ['product', 'model'],
  ['market', 'traction'],
  ['model', 'traction'],
];

export interface GateCopy {
  headline: string;
  lede: string;
  footnote: string;
  footnoteLinkLabel: string;
  footnoteLinkHref: string;
}

export const GATE_COPY: GateCopy = {
  headline: 'Welcome back to ZeroTo10.',
  lede: 'Sign in and Allya picks up where you left off — the work in flight, the decisions waiting on you, the whole company map.',
  footnote:
    'We’re currently rolling out ZeroTo10.ai to selected users. If you’d like an account, please apply on',
  footnoteLinkLabel: 'this link',
  footnoteLinkHref: 'https://www.linkedin.com/in/sanshat-bhatia',
};
