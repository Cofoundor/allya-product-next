import type { Metadata } from 'next';
import ServiceOnboarding from '@/components/service/ServiceOnboarding';
import { API_URL } from '@/lib/api/client';
import { paths } from '@/lib/api/resources';
import type { Surface } from '@/lib/api/types';
import '../../onboarding/onboarding.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}): Promise<Metadata> {
  const { service } = await params;
  // the floor's name is the backend's to give ("PR", not "Pr")
  let label = service.charAt(0).toUpperCase() + service.slice(1);
  try {
    const res = await fetch(`${API_URL}${paths.surface(service)}`, { cache: 'no-store' });
    if (res.ok) label = ((await res.json()) as Surface).label;
  } catch {
    /* the page's own error state covers this */
  }
  return { title: `Set up ${label} · Allya` };
}

export default async function Page({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  return <ServiceOnboarding surfaceId={service} />;
}
