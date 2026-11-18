import type { CurrencyCode, MinorAmount } from '@repo/types';

import type { FinanceTransaction } from '@repo/core';
import { listParams, readListScope, scopedRows, type ListScope } from '../list-scope';

const NOW = new Date(2026, 9, 14, 12);

function row(
  id: string,
  date: Date,
  fields: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  return {
    id,
    userId: 'kai',
    walletId: 'maybank',
    amountMinor: 1000 as MinorAmount,
    currency: 'MYR' as CurrencyCode,
    type: 'expense',
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: null,
    transferToWalletId: null,
    linkedTransactionId: null,
    description: null,
    merchant: null,
    notes: null,
    transactionDate: date.toISOString(),
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    autoAdded: false,
    balanceCorrection: false,
    createdAt: date.toISOString(),
    ...fields,
  };
}

const rows = [
  row('sep-salary', new Date(2026, 8, 25, 9), { type: 'income', categoryId: 'salary' }),
  row('oct-salary', new Date(2026, 9, 1, 9), { type: 'income', categoryId: 'salary' }),
  row('usd-salary', new Date(2026, 9, 2, 9), {
    type: 'income',
    categoryId: 'salary',
    currency: 'USD' as CurrencyCode,
  }),
  row('grab-1', new Date(2026, 9, 3, 8), { merchant: 'GRAB' }),
  row('grab-2', new Date(2026, 9, 9, 8), { merchant: 'Grab' }),
  row('grab-sep', new Date(2026, 8, 9, 8), { merchant: 'Grab' }),
  row('grab-refund', new Date(2026, 9, 10, 8), { merchant: 'Grab', type: 'income' }),
];

const ids = (scope: ListScope) => scopedRows(scope, rows, 'MYR', NOW).rows.map((item) => item.id);

describe('list scope params', () => {
  it.each<ListScope>([
    { kind: 'bill', seriesKey: 'expense|MYR|netflix' },
    { kind: 'merchant', merchant: 'Grab', type: 'expense', currency: 'MYR', month: '2026-10' },
    { kind: 'place', placeId: 'p1', range: '7d' },
    { kind: 'place', placeId: 'p1', range: null },
    { kind: 'category', categoryId: 'salary', month: '2026-10' },
    { kind: 'category', categoryId: 'salary', month: null },
  ])('opens the same %o it was given', (scope) => {
    const params = listParams('Title', scope);
    expect(params.title).toBe('Title');
    expect(readListScope(params)).toEqual(scope);
  });

  it('names no scope from a bare visit or a merchant missing its month', () => {
    expect(readListScope({})).toBeNull();
    expect(readListScope({ merchant: 'Grab', type: 'expense', currency: 'MYR' })).toBeNull();
  });
});

describe('scopedRows', () => {
  it('keeps one category in one month in the main currency, newest first', () => {
    expect(ids({ kind: 'category', categoryId: 'salary', month: '2026-10' })).toEqual(['oct-salary']);
    expect(ids({ kind: 'category', categoryId: 'salary', month: null })).toEqual([
      'oct-salary',
      'sep-salary',
    ]);
  });

  it('keeps one merchant of one type in one month, whatever its case', () => {
    expect(
      ids({ kind: 'merchant', merchant: 'Grab', type: 'expense', currency: 'MYR', month: '2026-10' }),
    ).toEqual(['grab-2', 'grab-1']);
  });

  it('lists nothing for a place or bill that is gone', () => {
    expect(ids({ kind: 'place', placeId: 'gone', range: null })).toEqual([]);
    expect(ids({ kind: 'bill', seriesKey: 'gone' })).toEqual([]);
  });
});
