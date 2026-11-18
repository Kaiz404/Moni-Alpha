import type { Metadata } from 'next';
import { Page, PageEmpty } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Activity · Moni' };

export default function ActivityPage() {
  return (
    <Page title="Activity" phone="tab-with-moni">
      <PageEmpty
        mood="neutral"
        title="No spending yet"
        line="Add your first spend with N, or link an app on a wallet so Moni catches them for you."
        action={{ label: 'Add a transaction', icon: 'plus', keys: 'N', tone: 'ink', run: { kind: 'add' } }}
      />
    </Page>
  );
}
