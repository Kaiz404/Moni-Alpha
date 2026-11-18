import type { Metadata } from 'next';
import { Page, PageEmpty } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Budget · Moni' };

export default function BudgetPage() {
  return (
    <Page title="Budget" phone="tab">
      <PageEmpty mood="thinking" title="No budgets yet" line="Set budgets and Moni starts each category from what you spend." />
    </Page>
  );
}
