import type { Metadata } from 'next';
import ChannelStudio from '@/components/email/ChannelStudio';
import '../../workspace.css';
import '../../surface.css';
import '../email/studio.css';

/* The same room, a different channel: templates Meta has to approve, a
   number that carries a quality rating, and a daily limit you earn. */

export const metadata: Metadata = { title: 'WhatsApp · Marketing · Allya' };

export default function Page() {
  return <ChannelStudio channelId="whatsapp" />;
}
