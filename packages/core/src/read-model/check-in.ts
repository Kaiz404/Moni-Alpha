import type { MinorAmount } from '@repo/types';

import type { Calendar } from '../calendar';
import type { FinanceWallet } from './types';

/** A balance the user confirmed longer ago than this is worth asking about again. */
export const CHECK_IN_AFTER_DAYS = 30;
/** Wallets that hold spendable money; a credit card's balance is a debt. */
const LIQUID_TYPES = new Set(['bank', 'cash', 'debit', 'ewallet']);
const IN_USE_DAYS = 56;

export type CheckIn = {
  wallet: FinanceWallet;
  balanceMinor: MinorAmount;
  /** Days since the user last confirmed or fixed the balance; null when never. */
  daysAgo: number | null;
};

/**
 * The wallet the check-in asks about ("Is Maybank Savings still RM2,281.80?"): a spendable wallet in
 * the main currency, used lately or holding money, whose balance went longest without a look.
 */
export function walletToCheckIn({
  wallets,
  balancesByWallet,
  lastUsedByWallet,
  currency,
  now,
  calendar,
}: {
  wallets: readonly FinanceWallet[];
  balancesByWallet: Readonly<Record<string, MinorAmount>>;
  /** The newest transaction date per wallet, either side of a transfer. */
  lastUsedByWallet: Readonly<Record<string, string>>;
  currency: string;
  now: Date;
  calendar: Calendar;
}): CheckIn | null {
  const today = calendar.dayNumber(now);
  const due = wallets.flatMap((wallet) => {
    if (!wallet.isActive || wallet.currency !== currency || !LIQUID_TYPES.has(wallet.type)) return [];
    const balanceMinor = balancesByWallet[wallet.id] ?? (0 as MinorAmount);
    const lastUsed = lastUsedByWallet[wallet.id];
    const inUse = (lastUsed !== undefined && today - calendar.dayNumber(lastUsed) <= IN_USE_DAYS) || balanceMinor !== 0;
    const daysAgo = wallet.balanceConfirmedAt ? today - calendar.dayNumber(wallet.balanceConfirmedAt) : null;
    if (!inUse || (daysAgo !== null && daysAgo <= CHECK_IN_AFTER_DAYS)) return [];
    return [{ wallet, balanceMinor, daysAgo }];
  });
  due.sort((a, b) => (b.daysAgo ?? Infinity) - (a.daysAgo ?? Infinity) || a.wallet.displayOrder - b.wallet.displayOrder);
  return due[0] ?? null;
}
