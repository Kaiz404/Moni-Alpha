import { currencyName, walletEffect, walletListMeta, type Calendar, type FinanceTransaction, type WalletGroup } from '@repo/core';
import { minorToDecimal, type MinorAmount } from '@repo/types';

/** What each wallet gained or lost this month, today included: All wallets' This month column. */
export function monthChanges(
  transactions: readonly Pick<FinanceTransaction, 'walletId' | 'transferToWalletId' | 'amountMinor' | 'type' | 'transactionDate'>[],
  now: Date,
  calendar: Calendar,
): Record<string, number> {
  const month = calendar.monthKey(now);
  const today = calendar.dayKey(now);
  const change: Record<string, number> = {};
  for (const transaction of transactions) {
    const day = calendar.dayKey(transaction.transactionDate);
    if (day > today || calendar.monthKey(transaction.transactionDate) !== month) continue;
    for (const id of [transaction.walletId, transaction.transferToWalletId]) {
      if (id) change[id] = (change[id] ?? 0) + Number(walletEffect(transaction, id));
    }
  }
  return change;
}

/** Assets and what is owed on cards in the main currency: the two figures beside net worth. */
export function assetsAndOwed(group: WalletGroup | undefined, balances: Readonly<Record<string, MinorAmount>>): { assetsMinor: number; owedMinor: number } {
  let assetsMinor = 0;
  let owedMinor = 0;
  for (const wallet of group?.wallets ?? []) {
    const balance = Number(balances[wallet.id] ?? 0);
    if (balance < 0) owedMinor -= balance;
    else assetsMinor += balance;
  }
  return { assetsMinor, owedMinor };
}

function cell(text: string): string {
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Download CSV on All wallets: one row a wallet, in list order, balances as plain decimals. */
export function walletsCsv(
  groups: readonly WalletGroup[],
  balances: Readonly<Record<string, MinorAmount>>,
  changes: Readonly<Record<string, number>>,
  linked: ReadonlySet<string>,
): string {
  const rows = groups.flatMap((group) =>
    group.wallets.map((wallet) =>
      [
        wallet.name,
        walletListMeta(wallet, group.main, linked.has(wallet.id)),
        currencyName(wallet.currency).name,
        wallet.currency,
        minorToDecimal(balances[wallet.id] ?? 0),
        minorToDecimal(changes[wallet.id] ?? 0),
      ]
        .map(cell)
        .join(','),
    ),
  );
  return ['Wallet,Kind,Currency name,Currency,Balance,This month', ...rows].join('\n') + '\n';
}
