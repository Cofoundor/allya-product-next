import type { Metadata } from 'next';
import ChannelStudio from '@/components/email/ChannelStudio';
import '../../workspace.css';
import '../../surface.css';
import './studio.css';
// the campaign sheet can open a person now, and the sheet brings its own look
import '../../people/crm.css';

/* One direction, opened all the way up. /marketing still belongs to the
   [service] route — a static folder with no page of its own doesn't take
   that segment. */

export const metadata: Metadata = { title: 'Email · Marketing · Allya' };

export default function Page() {
  return <ChannelStudio channelId="email" />;
}
