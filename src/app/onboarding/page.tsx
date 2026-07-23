import type { Metadata } from 'next';
import Onboarding from '@/components/onboarding/Onboarding';
import './onboarding.css';

export const metadata: Metadata = {
  title: 'Allya — onboarding',
  description:
    'Meet Allya — a short conversation with your AI cofounder. Watch your company brain build itself as you answer.',
};

export default function Page() {
  return <Onboarding />;
}
