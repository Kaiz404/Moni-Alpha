import { useValue } from '@legendapp/state/react';
import type { MinorAmount } from '@repo/types';
import { useMemo } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import type { FinanceWallet } from '@repo/core';
import { walletBalancesMinor$, walletsForUser$ } from '@/lib/finance/selectors';
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

/** A debt's wallet choice: a wallet's id, `NO_WALLET` when no money moved, or null before one is chosen. */
export const NO_WALLET = 'none';
export type DebtWalletChoice = string | null;

/** Opens the wallet sheet with the no-money row on top; resolves to the choice, or null when dismissed. */
export async function pickDebtWallet(
  title: string,
  wallets: FinanceWallet[],
  choice: DebtWalletChoice,
  noneLabel: string,
): Promise<DebtWalletChoice> {
  const picked = await openSheet({
    kind: 'wallet',
    title,
    wallets,
    selectedId: choice === NO_WALLET ? null : (choice ?? undefined),
    noneLabel,
    noneIcon: 'note-text-outline',
  });
  if (!picked) return null;
  return picked.walletId ?? NO_WALLET;
}
