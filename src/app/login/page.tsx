import type { Metadata } from 'next';
import LoginGate from '@/components/login/LoginGate';
import './login.css';

export const metadata: Metadata = {
  title: 'Log in · Allya',
  description: 'Sign in to ZeroTo10 — Allya picks up where you left off.',
};

export default function Page() {
  return <LoginGate />;
}
