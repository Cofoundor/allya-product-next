import type { Metadata } from 'next';
import EmailStudio from '@/components/email/EmailStudio';
import '../../workspace.css';
import '../../surface.css';
import './studio.css';

/* One direction, opened all the way up: the brain for email alone, the
   conversation that writes a campaign, and everything already in flight.
   /marketing still belongs to the [service] route — a static folder with
   no page of its own doesn't take that segment. */

export const metadata: Metadata = { title: 'Email · Marketing · Allya' };

export default function Page() {
  return <EmailStudio />;
}
