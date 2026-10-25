import type { FinanceWallet } from '@/lib/finance/types';
import { openSheet } from '@/lib/sheet/sheet-store';

/** "Which wallet paid?" over the wallets in the capture's currency (all of them when none match). */
export async function pickWallet(
  wallets: readonly FinanceWallet[],
  currency: string,
  selectedId: string | null,
): Promise<string | null> {
  const sameCurrency = wallets.filter((wallet) => wallet.currency === currency);
  const picked = await openSheet({
    kind: 'wallet',
    title: 'Which wallet paid?',
    wallets: (sameCurrency.length ? sameCurrency : wallets).map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      currency: wallet.currency,
      type: wallet.type,
      icon: wallet.icon,
      color: wallet.color,
      cardStyleId: wallet.cardStyleId,
    })),
    selectedId,
  });
  return picked?.walletId ?? null;
}
