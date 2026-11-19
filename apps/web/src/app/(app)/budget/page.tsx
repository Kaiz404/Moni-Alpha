import type { Metadata } from 'next';
import { BudgetScreen } from '@/components/budget/budget-screen';

export const metadata: Metadata = { title: 'Budget · Moni' };

export default function BudgetPage() {
  return <BudgetScreen />;
}
