import type { Metadata } from 'next';
import { VerifyView } from '@/components/auth/verify-view';

export const metadata: Metadata = { title: 'Check your email | Moni' };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const { email } = await searchParams;
  return <VerifyView email={typeof email === 'string' ? email : ''} />;
}
