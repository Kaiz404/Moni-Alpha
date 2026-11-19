import { merchantNameList, type FinanceTransaction, type MerchantEntry } from '@repo/core';
import type { MerchantAlias } from '@repo/types';

/** W2-Data's Merchant names table: every code to name and every name given, in one list. */
export type MerchantFilter = 'all' | 'toName' | 'named';
export type MerchantSort = 'payments' | 'name';

export const MERCHANTS_PER_PAGE = 25;

/** The payments behind each merchant key, as the phone's merchant list reads them. */
export function merchantTable(
  transactions: readonly FinanceTransaction[],
  aliases: readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[],
  walletNames: Record<string, string>,
): { toName: MerchantEntry[]; named: MerchantEntry[] } {
  return merchantNameList(
    transactions.flatMap((transaction) =>
      transaction.merchant
        ? [
            {
              merchant: transaction.merchant,
              walletId: transaction.walletId,
              categoryId: transaction.categoryId,
              transactionDate: transaction.transactionDate,
              fromAlert: transaction.metadata.source === 'notification',
            },
          ]
        : [],
    ),
    aliases,
    walletNames,
  );
}

export type MerchantPage = {
  rows: MerchantEntry[];
  counts: Record<MerchantFilter, number>;
  total: number;
  page: number;
  pages: number;
  first: number;
  last: number;
};

/** One page of the table for a filter, a search and a sort; the page is clamped into range. */
export function merchantPage(
  list: { toName: readonly MerchantEntry[]; named: readonly MerchantEntry[] },
  options: { filter: MerchantFilter; query: string; sort: MerchantSort; page: number },
): MerchantPage {
  const words = options.query.trim().toLowerCase();
  const matches = (entry: MerchantEntry) =>
    !words || [entry.raw, entry.name ?? '', entry.key].some((text) => text.toLowerCase().includes(words));
  const toName = list.toName.filter(matches);
  const named = list.named.filter(matches);
  const shown = options.filter === 'toName' ? toName : options.filter === 'named' ? named : [...toName, ...named];
  const sorted = [...shown].sort((a, b) =>
    options.sort === 'name'
      ? (a.name ?? a.raw).localeCompare(b.name ?? b.raw)
      : b.count - a.count || a.raw.localeCompare(b.raw),
  );
  const pages = Math.max(1, Math.ceil(sorted.length / MERCHANTS_PER_PAGE));
  const page = Math.min(Math.max(1, options.page), pages);
  const start = (page - 1) * MERCHANTS_PER_PAGE;
  const rows = sorted.slice(start, start + MERCHANTS_PER_PAGE);
  return {
    rows,
    counts: { all: toName.length + named.length, toName: toName.length, named: named.length },
    total: sorted.length,
    page,
    pages,
    first: rows.length ? start + 1 : 0,
    last: start + rows.length,
  };
}

/** How many payments a rename reaches: the ticked codes' payments together. */
export function paymentsOf(entries: readonly MerchantEntry[], keys: ReadonlySet<string>): number {
  return entries.filter((entry) => keys.has(entry.key)).reduce((sum, entry) => sum + entry.count, 0);
}
