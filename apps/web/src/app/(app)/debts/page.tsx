import type { Metadata } from 'next';
import { Page, PageEmpty } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Debts · Moni' };

export default function DebtsPage() {
  return (
    <Page title="Debts" phone="tab">
      <PageEmpty
        mood="happy"
        title="No debts yet"
        line="Lent a friend money, or they covered you? Note it here. Moni shows who owes who."
      />
    </Page>
  );
}
