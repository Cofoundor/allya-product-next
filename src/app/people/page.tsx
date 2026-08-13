import type { Metadata } from 'next';
import CrmStudio from '@/components/crm/CrmStudio';
import { PersonSheetProvider } from '@/lib/crm/personSheet';
import '../workspace.css';
import '../surface.css';
import '../marketing/email/studio.css';
import './crm.css';

/* The people layer. A static folder, so it beats the [service] route the
   way /marketing/email does — this isn't a floor, it's the book the floors
   all read from. */

export const metadata: Metadata = { title: 'People · Allya' };

export default function Page() {
  return (
    <PersonSheetProvider>
      <CrmStudio />
    </PersonSheetProvider>
  );
}
