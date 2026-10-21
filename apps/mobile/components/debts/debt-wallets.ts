import { useValue } from '@legendapp/state/react';
import type { MinorAmount } from '@repo/types';
import { useMemo } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { walletBalancesMinor$, walletsForUser$ } from '@/lib/finance/selectors';
import type { FinanceWallet } from '@/lib/finance/types';
import { openSheet } from '@/lib/sheet/sheet-store';

/** A debt's money moves only through wallets in its own currency. */
export function useDebtWallets(currency: string): {
  wallets: FinanceWallet[];
  balances: Record<string, MinorAmount>;
} {
  const { user } = useAuth();
  const all = useValue(walletsForUser$(user?.id ?? null));
  const balances = useValue(walletBalancesMinor$(user?.id ?? null));
  const wallets = useMemo(
    () => all.filter((wallet) => wallet.currency === currency),
    [all, currency],
  );
  return { wallets, balances };
}

export async function pickDebtWallet(
  title: string,
  wallets: FinanceWallet[],
  selectedId: string | null,
  currency: string,
): Promise<string | null> {
  const picked = await openSheet({
    kind: 'wallet',
    title,
    wallets,
    selectedId,
    emptyMessage: `Add a ${currency} wallet first.`,
  });
  return picked?.walletId ?? null;
}
