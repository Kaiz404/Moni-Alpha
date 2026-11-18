import { transactionTypeSchema, type TransactionType } from '@repo/types';

import { billPayments } from '@/lib/finance/bills';
import {
  groupPlaces,
  placeRange,
  type FinanceTransaction,
  isMonthKey,
  type MonthKey,
} from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

/**
 * Which rows `/transactions` lists: the "See all" of a detail page, pushed under it so Back
 * returns there instead of jumping to the Activity tab.
 */
export type ListScope =
  | { kind: 'bill'; seriesKey: string }
  /** One merchant's rows of one type and currency in one month, from a transaction's page. */
  | {
      kind: 'merchant';
      merchant: string;
      type: TransactionType;
      currency: string;
      month: MonthKey;
    }
  | { kind: 'place'; placeId: string; range: string | null }
  | { kind: 'category'; categoryId: string; month: MonthKey | null };

/** The route's params: the page title, then one scope's fields. */
export type ListParams = {
  title?: string;
  bill?: string;
  merchant?: string;
  type?: string;
  currency?: string;
  month?: string;
  placeId?: string;
  range?: string;
  categoryId?: string;
};

/** The params that open `/transactions` on `scope` under `title`. */
export function listParams(title: string, scope: ListScope): ListParams {
  switch (scope.kind) {
    case 'bill':
      return { title, bill: scope.seriesKey };
    case 'merchant':
      return {
        title,
        merchant: scope.merchant,
        type: scope.type,
        currency: scope.currency,
        month: scope.month,
      };
    case 'place':
      return scope.range
        ? { title, placeId: scope.placeId, range: scope.range }
        : { title, placeId: scope.placeId };
    case 'category':
      return scope.month
        ? { title, categoryId: scope.categoryId, month: scope.month }
        : { title, categoryId: scope.categoryId };
  }
}

/** The scope in the route's params, or null when they name none. */
export function readListScope(params: ListParams): ListScope | null {
  const month = isMonthKey(params.month) ? params.month : null;
  if (params.bill) return { kind: 'bill', seriesKey: params.bill };
  if (params.merchant) {
    const type = transactionTypeSchema.safeParse(params.type);
    if (!type.success || !params.currency || !month) return null;
    return {
      kind: 'merchant',
      merchant: params.merchant,
      type: type.data,
      currency: params.currency,
      month,
    };
  }
  if (params.placeId)
    return { kind: 'place', placeId: params.placeId, range: params.range ?? null };
  if (params.categoryId) return { kind: 'category', categoryId: params.categoryId, month };
  return null;
}

/** Whether a row falls in a category, in one month or in any. */
export function inCategory(
  transaction: FinanceTransaction,
  scope: Extract<ListScope, { kind: 'category' }>,
): boolean {
  return (
    transaction.categoryId === scope.categoryId &&
    (scope.month === null || deviceCalendar.monthKey(transaction.transactionDate) === scope.month)
  );
}

/**
 * The scope's rows, newest first, and the one currency they are in. A bill keeps its payments'
 * currency; a merchant names its own; a place or a category keeps to the main currency.
 */
export function scopedRows(
  scope: ListScope,
  transactions: readonly FinanceTransaction[],
  mainCurrency: string,
  now: Date,
): { rows: FinanceTransaction[]; currency: string } {
  const newestFirst = (rows: FinanceTransaction[]) =>
    rows.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  switch (scope.kind) {
    case 'bill': {
      const rows = billPayments(transactions, scope.seriesKey);
      return { rows, currency: rows[0]?.currency ?? mainCurrency };
    }
    case 'merchant': {
      const key = scope.merchant.toLowerCase();
      return {
        rows: newestFirst(
          transactions.filter(
            (row) =>
              row.merchant?.toLowerCase() === key &&
              row.currency === scope.currency &&
              row.type === scope.type &&
              deviceCalendar.monthKey(row.transactionDate) === scope.month,
          ),
        ),
        currency: scope.currency,
      };
    }
    case 'place': {
      const place = groupPlaces(transactions, {
        currency: mainCurrency,
        range: scope.range ? placeRange(scope.range, now, deviceCalendar).span : null,
      }, deviceCalendar).find((candidate) => candidate.id === scope.placeId);
      return { rows: newestFirst([...(place?.transactions ?? [])]), currency: mainCurrency };
    }
    case 'category':
      return {
        rows: newestFirst(
          transactions.filter(
            (row) => row.currency === mainCurrency && inCategory(row, scope),
          ),
        ),
        currency: mainCurrency,
      };
  }
}
