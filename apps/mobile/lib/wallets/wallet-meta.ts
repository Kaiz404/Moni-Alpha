import { labelForNotificationPackage } from '@/constants/notification-apps';
import { WALLET_TYPE_OPTIONS } from '@/constants/wallet-form';
import type { WalletAlertLink } from '@/lib/wallets/wallet-link';

function linkLabel(link: WalletAlertLink): string | null {
  return (
    link.notificationAppLabel ||
    (link.notificationPackage
      ? labelForNotificationPackage(link.notificationPackage)
      : null)
  );
}

/** "Bank, MYR, alerts from MAE": the line under a wallet's name on the form preview and the wallet page. */
export function walletMeta(
  type: string,
  currency: string,
  link: WalletAlertLink,
): string {
  const label =
    WALLET_TYPE_OPTIONS.find((option) => option.value === type)
      ?.label ?? 'Wallet';
  const app = linkLabel(link);
  return [label, currency, app ? `alerts from ${app}` : null]
    .filter(Boolean)
    .join(', ');
}
