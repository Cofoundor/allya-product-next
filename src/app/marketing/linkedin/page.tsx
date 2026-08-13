import type { Metadata } from 'next';
import ChannelStudio from '@/components/email/ChannelStudio';
import '../../workspace.css';
import '../../surface.css';
import '../email/studio.css';
import '../../people/crm.css';

/* The same room again, and the first channel that publishes by itself: two
   authors on one post, a credential that dies every sixty days, and a hold
   that exists because LinkedIn has no scheduled publish of its own. */

export const metadata: Metadata = { title: 'LinkedIn · Marketing · Allya' };

export default function Page() {
  return <ChannelStudio channelId="linkedin" />;
}
