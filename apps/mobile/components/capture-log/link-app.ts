import type { LinkedWallet } from '@/components/capture-sources/use-linked-apps';
import { labelForNotificationPackage } from '@/constants/notification-apps';
import { openSheet } from '@/lib/sheet/sheet-store';
import { updateWallet } from '@/lib/supabase/wallets';
import { showToast } from '@/lib/toast/toast-store';

/**
 * "Link Grab to a wallet" on a Not linked entry: pick a wallet, confirm when it
 * already reads another app (a wallet reads one app), then link it.
 */
export async function linkAppToWallet(
  app: { packageName: string; label: string },
  wallets: readonly LinkedWallet[],
): Promise<void> {
  const picked = await openSheet({
    kind: 'wallet',
    title: `Link ${app.label} to a wallet`,
    wallets: wallets.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      currency: wallet.currency,
      type: wallet.type,
      icon: wallet.icon,
      color: wallet.color,
      cardStyleId: wallet.cardStyleId,
    })),
    selectedId: null,
    emptyMessage: 'Add a wallet first, then link the app to it.',
  });
  const wallet = wallets.find((candidate) => candidate.id === picked?.walletId);
  if (!wallet) return;

  const current = wallet.notificationPackage;
  if (current && current !== app.packageName) {
    const confirmed = await openSheet({
      kind: 'confirm',
      title: `Link ${app.label} to ${wallet.name}?`,
      message: `${wallet.name} reads alerts from ${labelForNotificationPackage(current)} now. A wallet reads one app.`,
      confirmLabel: `Link ${app.label}`,
      cancelLabel: 'Keep it',
    });
    if (!confirmed) return;
  }

  try {
    await updateWallet(wallet.id, {
      notificationPackage: app.packageName,
      notificationAppLabel: app.label,
    });
    showToast({ text: `${app.label} is linked to ${wallet.name}` });
  } catch (error) {
    showToast({ text: error instanceof Error ? error.message : "Couldn't link the app." });
  }
}
