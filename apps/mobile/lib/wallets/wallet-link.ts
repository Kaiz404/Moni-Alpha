import { useValue } from '@legendapp/state/react';
import { useMemo } from 'react';

import { wallets$ } from '@/lib/store';
import { isActive } from '@/lib/store/helpers';

/** "Alerts from": the banking app whose notifications become this wallet's captures. */
export type WalletAlertLink = {
  notificationPackage: string | null;
  notificationAppLabel: string | null;
  notificationAccountHint: string | null;
};

type LinkRow = {
  name?: string | null;
  deleted?: boolean;
  is_active?: unknown;
  notification_package?: string | null;
  notification_app_label?: string | null;
  notification_account_hint?: string | null;
};

const rows = () => (wallets$.get() ?? {}) as Record<string, LinkRow | undefined>;

export function useWalletAlertLink(walletId: string): WalletAlertLink {
  const notificationPackage = useValue(() => rows()[walletId]?.notification_package ?? null);
  const notificationAppLabel = useValue(() => rows()[walletId]?.notification_app_label ?? null);
  const notificationAccountHint = useValue(
    () => rows()[walletId]?.notification_account_hint ?? null,
  );
  return useMemo(
    () => ({ notificationPackage, notificationAppLabel, notificationAccountHint }),
    [notificationAccountHint, notificationAppLabel, notificationPackage],
  );
}

/** Names of the other live wallets that read alerts from `packageName`. */
export function useWalletNamesLinkedTo(
  packageName: string | null,
  exceptWalletId: string | null,
): string[] {
  const joined = useValue(() =>
    packageName
      ? Object.entries(rows())
          .filter(
            ([id, row]) =>
              id !== exceptWalletId &&
              row &&
              !row.deleted &&
              isActive(row.is_active) &&
              row.notification_package === packageName,
          )
          .map(([, row]) => row?.name ?? '')
          .join('\n')
      : '',
  );
  return useMemo(() => (joined ? joined.split('\n') : []), [joined]);
}
