'use client';

import { Page, PageEmpty } from '@/components/shell/page';
import { useShellApi } from '@/components/shell/shell-context';

export default function HomePage() {
  const { user } = useShellApi();
  return (
    <Page title={`Welcome to Moni, ${user.name}`} phone="home">
      <PageEmpty
        mood="neutral"
        title="No transactions yet"
        line="Type it, scan a receipt or tell Moni. Your newest show here."
        action={{ label: 'Add a transaction', icon: 'plus', keys: 'N', tone: 'ink', run: { kind: 'add' } }}
      />
    </Page>
  );
}
