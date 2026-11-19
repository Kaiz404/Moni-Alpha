import type { Metadata } from 'next';
import { ResetView } from '@/components/auth/reset-view';

export const metadata: Metadata = { title: 'Set a new password | Moni' };

export default function ResetPage() {
  return <ResetView />;
}
