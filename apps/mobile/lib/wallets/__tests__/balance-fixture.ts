import { decimalToMinor } from '@repo/types';
import {
  EMPTY_FINANCE_PROJECTION,
  type FinanceProjection,
  type FinanceTransaction,
  type FinanceWallet,
} from '@/lib/finance/types';

export const USER = 'user_1';
export const NOW = new Date(2026, 9, 12, 10);
export const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

export function financeWallet(over: Partial<FinanceWallet> = {}): FinanceWallet {
  return {
    id: 'maybank',
    userId: USER,
    name: 'Maybank',
    type: 'bank',
    currency: 'MYR',
    initialBalanceMinor: decimalToMinor('3000'),
    color: null,
    icon: null,
    cardStyleId: null,
    isActive: true,
    displayOrder: 0,
    balanceConfirmedAt: daysAgo(40),
    ...over,
  };
}

export function expense(id: string, date: string, over: Partial<FinanceTransaction> = {}) {
  return {
    id,
    userId: USER,
    walletId: 'maybank',
    amountMinor: decimalToMinor('100'),
    currency: 'MYR',
    type: 'expense',
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: null,
    transferToWalletId: null,
    linkedTransactionId: null,
    description: null,
    merchant: 'Mamak Corner',
    notes: null,
    transactionDate: date,
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    autoAdded: false,
    createdAt: date,
    ...over,
  } satisfies FinanceTransaction;
}

/** Two months of MYR history: enough for a forecast once balances are confirmed. */
export function projection(
  wallets: FinanceWallet[],
  transactions: FinanceTransaction[] = [expense('t1', daysAgo(60)), expense('t2', daysAgo(2))],
): FinanceProjection {
  const byWallet: Record<string, string[]> = {};
  for (const tx of transactions) (byWallet[tx.walletId] ??= []).push(tx.id);
  return {
    ...EMPTY_FINANCE_PROJECTION,
    walletsById: Object.fromEntries(wallets.map((w) => [w.id, w])),
    transactionsById: Object.fromEntries(transactions.map((tx) => [tx.id, tx])),
    transactionsByWallet: byWallet,
  };
}
