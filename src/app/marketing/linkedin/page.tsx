import type { Metadata } from 'next';
import ChannelStudio from '@/components/email/ChannelStudio';
import { LinkedinPane } from '@/components/linkedin/LinkedinPane';
import '../../workspace.css';
import '../../surface.css';
import '../email/studio.css';
import '../../people/crm.css';
import './linkedin.css';

/* The same room again, and the first channel that publishes by itself: two
   authors on one post, a credential that dies every sixty days, and a hold
   that exists because LinkedIn has no scheduled publish of its own.

   Which is why this is the one channel that hands ChannelStudio its own
   right-hand pane. The conversation half is the shared room reading the
   product API; the work half is the publishing backend, and the accounts,
   the hold and the delete in there are real. */

export const metadata: Metadata = { title: 'LinkedIn · Marketing · Allya' };

export default function Page() {
  return (
    <ChannelStudio channelId="linkedin" sidebar={<LinkedinPane />} sidebarLabel="LinkedIn posts" />
  );
}
