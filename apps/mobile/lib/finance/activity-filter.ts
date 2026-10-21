import { addMinor, minorToNumber, type CurrencyCode, type MinorAmount } from '@repo/types';

import { toLocalDateInput } from '@/lib/dates/local-date-input';
import type { FinanceTransaction } from '@/lib/finance/types';

export type ActivityKind = 'all' | FinanceTransaction['type'];

export type ActivityFilter = {
  query: string;
  /** Null shows every wallet; a wallet also matches transfers into it. */
  walletId: string | null;
  mainCurrency: CurrencyCode;
  kind: ActivityKind;
  /** Local `YYYY-MM-DD`, or null for every day. */
  day: string | null;
  categoryNames: Readonly<Record<string, string>>;
};

export type ActivityDay = {
  /** Local `YYYY-MM-DD`. */
  key: string;
  transactions: FinanceTransaction[];
  spentMinor: MinorAmount;
  inMinor: MinorAmount;
};

function matchesQuery(
  transaction: FinanceTransaction,
  query: string,
  categoryNames: ActivityFilter['categoryNames'],
): boolean {
  const text = [
    transaction.merchant,
    transaction.description,
    transaction.notes,
    transaction.categoryId ? categoryNames[transaction.categoryId] : null,
  ];
  if (text.some((value) => value?.toLowerCase().includes(query))) return true;
  const amount = query.replace(/^rm/, '').replaceAll(',', '');
  return (
    /^\d+(\.\d*)?$/.test(amount) &&
    minorToNumber(transaction.amountMinor).toFixed(2).startsWith(amount)
  );
}

/**
 * The rows Activity shows, newest first: main currency only, then the wallet,
 * kind and day filters, then a case-insensitive match on merchant, description,
 * note, category name, or the start of the amount.
 */
export function filterActivity(
  transactions: readonly FinanceTransaction[],
  filter: ActivityFilter,
): FinanceTransaction[] {
  const query = filter.query.trim().toLowerCase();
  return transactions
    .filter(
      (transaction) =>
        transaction.currency === filter.mainCurrency &&
        (filter.walletId === null ||
          transaction.walletId === filter.walletId ||
          transaction.transferToWalletId === filter.walletId) &&
        (filter.kind === 'all' || transaction.type === filter.kind) &&
        (filter.day === null ||
          toLocalDateInput(new Date(transaction.transactionDate)) === filter.day) &&
        (query === '' || matchesQuery(transaction, query, filter.categoryNames)),
    )
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

/** Groups newest-first rows by local day. Day totals leave transfers out. */
export function groupActivityDays(transactions: readonly FinanceTransaction[]): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const transaction of transactions) {
    const key = toLocalDateInput(new Date(transaction.transactionDate));
    let day = days.at(-1);
    if (day?.key !== key) {
      day = {
        key,
        transactions: [],
        spentMinor: 0 as MinorAmount,
        inMinor: 0 as MinorAmount,
      };
      days.push(day);
    }
    day.transactions.push(transaction);
    if (transaction.type === 'expense')
      day.spentMinor = addMinor(day.spentMinor, transaction.amountMinor);
    else if (transaction.type === 'income')
      day.inMinor = addMinor(day.inMinor, transaction.amountMinor);
  }
  return days;
}
