import type { Metadata } from 'next';
import CrmStudio from '@/components/crm/CrmStudio';
import { PersonSheetProvider } from '@/lib/crm/personSheet';
import '../../workspace.css';
import '../../surface.css';
import '../../marketing/email/studio.css';
import '../crm.css';

/* The same layer with the accounts lens up. A static folder, so it beats
   /people/[personId] — nobody is ever going to be called "companies". */

export const metadata: Metadata = { title: 'Companies · People · Allya' };

export default function Page() {
  return (
    <PersonSheetProvider>
      <CrmStudio lens="companies" />
    </PersonSheetProvider>
  );
}
