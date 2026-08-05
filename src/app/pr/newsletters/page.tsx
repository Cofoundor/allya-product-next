import type { Metadata } from 'next';
import ChannelStudio from '@/components/email/ChannelStudio';
import '../../workspace.css';
import '../../surface.css';
import '../../marketing/email/studio.css';

/* The press newsletter: the same room as the marketing channels, on a
   different floor. /pr still belongs to the [service] route — a static
   folder with no page of its own doesn't take that segment. */

export const metadata: Metadata = { title: 'Newsletters · PR · Allya' };

export default function Page() {
  return <ChannelStudio channelId="newsletters" />;
}
