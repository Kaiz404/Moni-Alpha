'use client';

import { Page, PageEmpty } from '@/components/shell/page';
import { useShellApi } from '@/components/shell/shell-context';
import { useWalletCount } from '@/lib/use-wallet-count';

export default function HomePage() {
  const { user } = useShellApi();
  const wallets = useWalletCount();
  return (
    <Page title={`Welcome to Moni, ${user.name}`} phone="home">
      <PageEmpty
        mood="neutral"
        title="No transactions yet"
        line="Type it, scan a receipt or tell Moni. Your newest show here."
        action={{ label: 'Add a transaction', icon: 'plus', keys: 'N', tone: 'ink', run: { kind: 'add' } }}
      >
        {wallets !== null && (
          <p className="empty-line" data-wallet-count={wallets}>
            {wallets === 1 ? '1 wallet' : `${wallets} wallets`} synced from Moni
          </p>
        )}
      </PageEmpty>
    </Page>
  );
}
