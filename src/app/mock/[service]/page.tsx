import type { Metadata } from 'next';
import MockFloor from '@/components/mock/MockFloor';
import '../../workspace.css';
import './mock.css';

export const metadata: Metadata = { title: 'Design mock · Allya' };

export default async function Page({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  return <MockFloor surfaceId={service} />;
}
