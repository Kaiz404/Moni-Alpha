import { firstDayOf, merchantName, transactionRow, type TransactionRow } from '@repo/core';
import { DEFAULT_QUERY, selectActivity, type ActivityItem, type ActivityQuery } from './activity-query';
import { sourceOf } from './ledger/format';
import type { Ledger } from './ledger/use-ledger';

export type ActivityEntry = ActivityItem & { row: TransactionRow };

/** Activity's rows in the main currency, as its list and Moni chat both read them. */
export function activityItems(ledger: Ledger): ActivityEntry[] {
  const { transactions, currency, aliases, projection, walletNames, calendar } = ledger;
  return transactions
    .filter((transaction) => transaction.currency === currency)
    .map((transaction) => {
      const row = transactionRow(
        { ...transaction, merchant: merchantName(transaction.merchant, aliases) },
        { categoriesById: projection.categoriesById, walletNames },
      );
      return {
        id: transaction.id,
        at: transaction.transactionDate,
        day: calendar.dayKey(transaction.transactionDate),
        title: row.title,
        kind: transaction.type,
        categoryId: transaction.categoryId,
        category: row.category,
        walletId: transaction.walletId,
        toWalletId: transaction.transferToWalletId,
        wallet: row.wallet,
        source: sourceOf(transaction.metadata),
        auto: transaction.autoAdded,
        amountMinor: Number(transaction.amountMinor),
        hasPlace: transaction.locationLatitude !== null || transaction.locationName !== null,
        notes: transaction.notes,
        row,
      };
    });
}

/** The default span a view covers: this month so far. */
export function monthSoFar(ledger: Pick<Ledger, 'calendar' | 'now'>): { from: string; to: string } {
  return { from: firstDayOf(ledger.calendar.monthKey(ledger.now)), to: ledger.calendar.dayKey(ledger.now) };
}

/**
 * The rows a person is looking at: on Activity the ticked rows, or else every row its view selects;
 * anywhere else this month so far.
 */
export function rowsInView(items: readonly ActivityItem[], query: ActivityQuery | null, ticked: readonly string[], range: { from: string; to: string }): ActivityItem[] {
  if (query && ticked.length) return items.filter((item) => ticked.includes(item.id));
  return selectActivity(items, query ?? DEFAULT_QUERY, range);
}
