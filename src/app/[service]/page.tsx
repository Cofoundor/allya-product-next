import type { Metadata } from 'next';
import SurfaceWorkspace from '@/components/surface/SurfaceWorkspace';
import { API_URL } from '@/lib/api/client';
import { paths } from '@/lib/api/resources';
import type { Surface } from '@/lib/api/types';
import '../workspace.css';
import '../surface.css';

/* One route for every service floor. The static siblings (/login,
   /onboarding) still win, and a slug the API doesn't know renders as a
   surface that never loads — which is what its own error state is for. */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}): Promise<Metadata> {
  const { service } = await params;
  // the label is the backend's to name ("PR", not "Pr") — ask it, and fall
  // back to the slug only if it can't answer
  let label = service.charAt(0).toUpperCase() + service.slice(1);
  try {
    const res = await fetch(`${API_URL}${paths.surface(service)}`, { cache: 'no-store' });
    if (res.ok) label = ((await res.json()) as Surface).label;
  } catch {
    /* the page's own offline state covers this */
  }
  return { title: `${label} · Allya` };
}

export default async function Page({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  return <SurfaceWorkspace surfaceId={service} />;
}
