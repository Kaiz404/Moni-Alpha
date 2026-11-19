import type { Metadata } from 'next';
import { DebtsScreen } from '@/components/debts/debts-screen';

export const metadata: Metadata = { title: 'Debts · Moni' };

export default function DebtsPage() {
  return <DebtsScreen />;
}
