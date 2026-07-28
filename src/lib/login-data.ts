/* ============================================================
   The graph behind the sign-in gate.

   Not the workspace brain (that one is a company's departments and
   its live work) — this is the company as an outsider meets it:
   ZeroTo10 at the hub, then Product, Market, Traction, Model and
   Team with the things under each. It only has to drift and think;
   nothing here is clickable or tied to work.
   ============================================================ */

import type { NodeSpec } from './brain';

export const LOGIN_BRAIN_NODES: NodeSpec[] = [
  { id: 'co', label: 'ZeroTo10', tier: 0, group: 'core' },

  { id: 'product', label: 'Product', tier: 1, group: 'product', parent: 'co' },
  { id: 'p1', label: 'Allya', tier: 2, group: 'product', parent: 'product' },
  { id: 'p2', label: 'Agents', tier: 2, group: 'product', parent: 'product' },
  { id: 'p3', label: 'Experts', tier: 2, group: 'product', parent: 'product' },
  { id: 'p4', label: 'Onboarding', tier: 2, group: 'product', parent: 'product' },

  { id: 'market', label: 'Market', tier: 1, group: 'market', parent: 'co' },
  { id: 'm1', label: 'Who it is for', tier: 2, group: 'market', parent: 'market' },
  { id: 'm2', label: 'Market size', tier: 2, group: 'market', parent: 'market' },
  { id: 'm3', label: 'Competition', tier: 2, group: 'market', parent: 'market' },

  { id: 'traction', label: 'Traction', tier: 1, group: 'traction', parent: 'co' },
  { id: 't1', label: 'Stage', tier: 2, group: 'traction', parent: 'traction' },
  { id: 't2', label: 'Proof', tier: 2, group: 'traction', parent: 'traction' },
  { id: 't3', label: 'Roadmap', tier: 2, group: 'traction', parent: 'traction' },

  { id: 'model', label: 'Model', tier: 1, group: 'model', parent: 'co' },
  { id: 'o1', label: 'Pricing', tier: 2, group: 'model', parent: 'model' },
  { id: 'o2', label: 'Unit economics', tier: 2, group: 'model', parent: 'model' },
  { id: 'o3', label: 'Go-to-market', tier: 2, group: 'model', parent: 'model' },

  { id: 'team', label: 'Team', tier: 1, group: 'team', parent: 'co' },
  { id: 'e1', label: 'Founders', tier: 2, group: 'team', parent: 'team' },
  { id: 'e2', label: 'Origin', tier: 2, group: 'team', parent: 'team' },
];

/* three strands that skip the hub — the graph reads as a business, not a
   filing cabinet: what you sell prices itself, what you've proven is what
   the market rewarded, and the model is what the traction pays for */
export const LOGIN_BRAIN_CROSS: [string, string][] = [
  ['product', 'model'],
  ['market', 'traction'],
  ['model', 'traction'],
];
