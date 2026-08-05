import type { Metadata } from 'next';
import LoginGate from '@/components/login/LoginGate';
import './login.css';

export const metadata: Metadata = {
  title: 'Allya — log in',
  description:
    'Sign in to ZeroTo10 — Allya picks up where you left off: the work in flight, the decisions waiting on you, the whole company map.',
};

export default function Page() {
  return <LoginGate />;
}
