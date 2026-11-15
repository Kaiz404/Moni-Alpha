import { router } from 'expo-router';

import type { LinkedWallet } from '@/components/capture-sources/use-linked-apps';
import { walletForApp, type MissedTransactionParams } from '@/lib/notifications/missed-report';

/** Type it for one source: the wallet it feeds, ready for the amount. */
export function reportMissedFrom(packageName: string, wallets: readonly LinkedWallet[]) {
  const wallet = walletForApp(packageName, wallets);
  const params: MissedTransactionParams = {
    missedFrom: packageName,
    ...(wallet ? { walletId: wallet.id } : {}),
  };
  router.push({ pathname: '/transaction/new', params });
}
