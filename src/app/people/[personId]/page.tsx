import type { Metadata } from 'next';
import CrmStudio from '@/components/crm/CrmStudio';
import { PersonSheetProvider } from '@/lib/crm/personSheet';
import '../../workspace.css';
import '../../surface.css';
import '../../marketing/email/studio.css';
import '../crm.css';

/* One person, deep-linked. The layer opens with the record already up
   rather than as a page of its own — a person is somewhere you look, not
   somewhere you go, and closing the sheet leaves you in the book. */

export const metadata: Metadata = { title: 'A person · Allya' };

export default async function Page({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  return (
    <PersonSheetProvider initialId={personId}>
      <CrmStudio />
    </PersonSheetProvider>
  );
}
