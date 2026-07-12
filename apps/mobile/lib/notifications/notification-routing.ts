import type { AiWalletContext } from '@/lib/ai/client/types';

export type WalletNotificationLink = {
  id: string;
  name: string;
  type?: string | null;
  currency?: string | null;
  notificationPackage?: string | null;
  notificationAppLabel?: string | null;
  notificationAccountHint?: string | null;
};

export type NotificationCandidateResult = {
  candidates: AiWalletContext[];
  lockedWalletId: string | null;
};

export function toAiWalletContext(wallet: WalletNotificationLink): AiWalletContext {
  return {
    id: wallet.id,
    name: wallet.name ?? '',
    type: wallet.type ?? null,
    currency: wallet.currency ?? null,
    accountHint: wallet.notificationAccountHint?.trim() || null,
  };
}

/** Narrow wallets to those linked to the notification's Android package. */
export function resolveNotificationCandidates(
  packageName: string,
  wallets: WalletNotificationLink[],
): NotificationCandidateResult {
  const linked = wallets.filter((w) => w.notificationPackage === packageName);
  const candidates = linked.map(toAiWalletContext);
  return {
    candidates,
    lockedWalletId: candidates.length === 1 ? candidates[0].id : null,
  };
}
