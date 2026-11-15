import { curatedPackagesEquivalent } from '@/lib/notifications/notification-package-aliases';

/** Params for Type it (`app/transaction/new.tsx`). `missedFrom` records the source on save. */
export type MissedTransactionParams = {
  missedFrom: string;
  walletId?: string;
};

/** The wallet a linked app feeds, for Type it to open on. A wallet reads one app. */
export function walletForApp<W extends { id: string; notificationPackage: string | null }>(
  packageName: string,
  wallets: readonly W[],
): W | undefined {
  return wallets.find((wallet) => curatedPackagesEquivalent(wallet.notificationPackage, packageName));
}
