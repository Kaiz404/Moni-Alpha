import { useValue } from '@legendapp/state/react';

import { labelForNotificationPackage } from '@/constants/notification-apps';
import { useAuth } from '@/lib/auth/auth-context';
import { wallets$ } from '@/lib/store';
import { isActive } from '@/lib/store/helpers';

export type LinkedWallet = {
  id: string;
  name: string;
  recordLocation: boolean;
  notificationPackage: string | null;
  currency: string;
  type: string | null;
  icon: string | null;
  color: string | null;
  cardStyleId: string | null;
};

/** A banking app linked to one or more wallets; its alerts become captures. */
export type LinkedApp = {
  packageName: string;
  label: string;
  wallets: LinkedWallet[];
  /** Location from notifications: on while any of its wallets records location. */
  recordsLocation: boolean;
};

type WalletRow = {
  id?: string;
  user_id?: string | null;
  name?: string | null;
  currency?: string | null;
  type?: string | null;
  icon?: string | null;
  color?: string | null;
  card_style_id?: string | null;
  is_active?: boolean | number | null;
  display_order?: number | null;
  notification_package?: string | null;
  notification_app_label?: string | null;
  record_location?: boolean | null;
  deleted?: boolean;
};

function activeWallets(
  rows: Record<string, WalletRow | undefined> | undefined,
  userId: string | null,
): (LinkedWallet & { label: string | null })[] {
  return Object.values(rows ?? {})
    .filter(
      (row): row is WalletRow & { id: string } =>
        !!row?.id && !row.deleted && isActive(row.is_active) && row.user_id === userId,
    )
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((row) => ({
      id: row.id,
      name: row.name ?? '',
      recordLocation: row.record_location !== false,
      notificationPackage: row.notification_package?.trim() || null,
      label: row.notification_app_label?.trim() || null,
      currency: row.currency ?? 'MYR',
      type: row.type ?? null,
      icon: row.icon ?? null,
      color: row.color ?? null,
      cardStyleId: row.card_style_id ?? null,
    }));
}

function linkedApps(wallets: readonly (LinkedWallet & { label: string | null })[]) {
  const apps = new Map<string, LinkedApp>();
  for (const { label, ...wallet } of wallets) {
    const packageName = wallet.notificationPackage;
    if (!packageName) continue;
    const app = apps.get(packageName) ?? {
      packageName,
      label: label ?? labelForNotificationPackage(packageName),
      wallets: [],
      recordsLocation: false,
    };
    app.wallets.push(wallet);
    app.recordsLocation ||= wallet.recordLocation;
    apps.set(packageName, app);
  }
  return [...apps.values()];
}

/** The signed-in user's active wallets and the apps linked to them, live from the store. */
export function useLinkedApps(): { wallets: LinkedWallet[]; apps: LinkedApp[] } {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useValue(() => {
    const wallets = activeWallets(
      wallets$.get() as Record<string, WalletRow | undefined> | undefined,
      userId,
    );
    return { wallets, apps: linkedApps(wallets) };
  });
}
