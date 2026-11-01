import { router } from 'expo-router';

import type { LinkedApp, LinkedWallet } from '@/components/capture-sources/use-linked-apps';
import {
  prefillFromAlert,
  walletForApp,
  type MissedTransactionParams,
} from '@/lib/notifications/missed-report';
import { openSheet } from '@/lib/sheet/sheet-store';

function openTypeIt(params: MissedTransactionParams) {
  router.push({ pathname: '/transaction/new', params });
}

function sourceParams(packageName: string, wallets: readonly LinkedWallet[]) {
  const wallet = walletForApp(packageName, wallets);
  return { missedFrom: packageName, ...(wallet ? { walletId: wallet.id } : {}) };
}

/** Type it for one source: the wallet it feeds, ready for the amount. */
export function reportMissedFrom(packageName: string, wallets: readonly LinkedWallet[]) {
  openTypeIt(sourceParams(packageName, wallets));
}

/** An alert Moni read and ignored: Type it opens holding what the alert said. */
export function reportIgnoredAlert(
  alert: { packageName: string; text: string; receivedAt: string },
  wallets: readonly LinkedWallet[],
) {
  openTypeIt({
    ...sourceParams(alert.packageName, wallets),
    ...prefillFromAlert(alert.text, alert.receivedAt),
  });
}

/** A payment with no alert at all. With more than one linked app, ask which one missed it. */
export async function reportMissed(apps: readonly LinkedApp[], wallets: readonly LinkedWallet[]) {
  if (apps.length === 1) {
    reportMissedFrom(apps[0]!.packageName, wallets);
    return;
  }
  const linked = apps.flatMap((app) => app.wallets);
  const picked = await openSheet({
    kind: 'wallet',
    title: 'Which wallet did Moni miss?',
    wallets: linked.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      currency: wallet.currency,
      type: wallet.type,
      icon: wallet.icon,
      color: wallet.color,
      cardStyleId: wallet.cardStyleId,
    })),
    selectedId: null,
  });
  const wallet = linked.find((candidate) => candidate.id === picked?.walletId);
  if (wallet?.notificationPackage) {
    openTypeIt({ missedFrom: wallet.notificationPackage, walletId: wallet.id });
  }
}
