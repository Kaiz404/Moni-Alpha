import type { Metadata } from 'next';
import { ForgotView } from '@/components/auth/forgot-view';

export const metadata: Metadata = { title: 'Reset your password · Moni' };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const { email } = await searchParams;
  return <ForgotView initialEmail={typeof email === 'string' ? email : ''} />;
}
