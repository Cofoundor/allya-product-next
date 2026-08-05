import type { Metadata } from 'next';
import EmailDirection from '@/components/mock/EmailDirection';
import '../../workspace.css';
import '../[service]/mock.css';
import './email.css';

export const metadata: Metadata = { title: 'Email · design mock · Allya' };

export default function Page() {
  return <EmailDirection />;
}
