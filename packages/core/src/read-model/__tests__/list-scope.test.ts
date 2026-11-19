import { describe, expect, it } from 'vitest';
import type { CurrencyCode, MinorAmount } from '@repo/types';

import { type Calendar, createCalendar } from '../../calendar';
import { listParams, readListScope, scopedRows, type ListScope } from '../list-scope';
import type { FinanceTransaction } from '../types';

const KL = createCalendar('Asia/Kuala_Lumpur');
const NOW = new Date('2026-10-14T12:00:00+08:00');

function row(
  id: string,
  date: string,
  fields: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  return {
    id,
    userId: 'kai',
    receiptImageUrl: null,
    metadata: {},
    updatedAt: '2026-10-01T00:00:00.000Z',
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
    transactionDate: new Date(date).toISOString(),
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    placeId: null,
    placeCoordsAt: null,
    autoAdded: false,
    balanceCorrection: false,
    createdAt: new Date(date).toISOString(),
    ...fields,
  };
}

const rows = [
  row('sep-salary', '2026-09-25T09:00:00+08:00', { type: 'income', categoryId: 'salary' }),
  row('oct-salary', '2026-10-01T09:00:00+08:00', { type: 'income', categoryId: 'salary' }),
  row('usd-salary', '2026-10-02T09:00:00+08:00', {
    type: 'income',
    categoryId: 'salary',
    currency: 'USD' as CurrencyCode,
  }),
  row('grab-1', '2026-10-03T08:00:00+08:00', { merchant: 'GRAB' }),
  row('grab-2', '2026-10-09T08:00:00+08:00', { merchant: 'Grab' }),
  row('grab-sep', '2026-09-09T08:00:00+08:00', { merchant: 'Grab' }),
  row('grab-refund', '2026-10-10T08:00:00+08:00', { merchant: 'Grab', type: 'income' }),
];

const ids = (scope: ListScope, calendar: Calendar = KL) =>
  scopedRows(scope, rows, 'MYR', NOW, calendar).rows.map((item) => item.id);

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

  it("files a month's rows by the calendar's zone", () => {
    const LA = createCalendar('America/Los_Angeles');
    expect(ids({ kind: 'category', categoryId: 'salary', month: '2026-10' }, LA)).toEqual([]);
    expect(ids({ kind: 'category', categoryId: 'salary', month: '2026-09' }, LA)).toEqual([
      'oct-salary',
      'sep-salary',
    ]);
  });
});
