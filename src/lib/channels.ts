import { GROUPS, branchTints } from './brain';
import type { Nouns } from './api/types';

/* ============================================================
   The channels a campaign can go out on.

   A direction's page is the same page whichever channel it serves — what
   changes is its hue, its words and what "in good standing" means. Both
   of those come from the API; this holds only what the client needs
   before the first byte arrives.
   ============================================================ */

export interface Channel {
  id: string;
  label: string;
  /** which of the marketing floor's eight tints this direction wears —
      the same index the API gives it in MARKETING_BRANCHES */
  tint: 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b7' | 'b8';
  /** the composer's line, before the API answers */
  placeholder: string;
  suggestions: string[];
  /** what the "what I know" box is called here */
  knowTitle: string;
  /** which work items belong to this channel — the pane must not show
      email's newsletter on the WhatsApp page */
  workRe: RegExp;
}

export const CHANNELS: Record<string, Channel> = {
  email: {
    id: 'email',
    label: 'Email',
    tint: 'b4',
    placeholder: 'Direct Allya — what should this one say?',
    suggestions: ['Write next week’s newsletter', 'Win back the quiet ones', 'A plain send, from me'],
    knowTitle: 'What I know about your emails',
    workRe: /email|newsletter|warm(ing|-up| 200)/i,
  },
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp',
    // ninth in the floor's list, so it wraps to the first tint — the same
    // colour the dot wears on the marketing brain
    tint: 'b1',
    placeholder: 'Direct Allya — what should this broadcast say?',
    suggestions: ['Write the festive offer', 'Ask the quiet ones one question', 'A utility template, not marketing'],
    knowTitle: 'What I know about your WhatsApp',
    workRe: /whatsapp|broadcast|template/i,
  },
};

export const channelOf = (id: string): Channel => CHANNELS[id] ?? CHANNELS.email;

/** a direction's hue: one of the marketing floor's branch tints */
export const channelAccent = (c: Channel) => branchTints(GROUPS.marketing)[c.tint];

/** the API's words for this channel, with a safe fallback while it loads */
export const NOUNS_FALLBACK: Nouns = {
  one: 'campaign',
  many: 'campaigns',
  metric: 'opened',
  automations: 'automations',
  audienceWord: 'list',
};
