import type { MinorAmount } from '@repo/types';
import { dayNumber } from './days';
import {
  MAX_BALANCE_AGE_DAYS,
  balanceMinor,
  confirmedDaysAgo,
  inUseWallets,
  liquidWallets,
  type FactsWallet,
} from './forecast';
import type { FactsTransaction } from './recurring';

export type WalletToConfirm<W extends FactsWallet> = {
  wallet: W;
  /** Native-currency balance as of `today`. */
  balanceMinor: MinorAmount;
  /** Null when the balance was never confirmed. */
  daysSinceConfirmed: number | null;
};

/**
 * The wallets keeping the forecast from showing: liquid wallets in use, as the forecast counts
 * them, whose balance was never confirmed or not within MAX_BALANCE_AGE_DAYS. Keeps input order.
 */
export function walletsNeedingConfirmation<W extends FactsWallet>(
  wallets: readonly W[],
  transactions: readonly FactsTransaction[],
  today: Date,
): WalletToConfirm<W>[] {
  const known = transactions.filter((tx) => new Date(tx.transactionDate) <= today);
  const inUse = new Set(
    [...new Set(wallets.map((w) => w.currency))].flatMap((currency) =>
      inUseWallets(
        liquidWallets(wallets, currency),
        known.filter((tx) => tx.currency === currency),
        today,
      ).map((w) => w.id),
    ),
  );
  const day = dayNumber(today);
  return wallets.flatMap((wallet) => {
    const daysSinceConfirmed = confirmedDaysAgo(wallet, day);
    if (
      !inUse.has(wallet.id) ||
      (daysSinceConfirmed !== null && daysSinceConfirmed <= MAX_BALANCE_AGE_DAYS)
    )
      return [];
    return [
      {
        wallet,
        balanceMinor: balanceMinor([wallet], known, today) as MinorAmount,
        daysSinceConfirmed,
      },
    ];
  });
}
