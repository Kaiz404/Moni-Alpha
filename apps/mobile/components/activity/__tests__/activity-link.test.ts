import type { CurrencyCode, MinorAmount } from '@repo/types';

import { inScope, readActivityLink, scopeLabel } from '@/components/activity/activity-link';
import type { FinanceTransaction } from '@/lib/finance/types';

function row(id: string, categoryId: string | null, date: Date): FinanceTransaction {
  return {
    id,
    userId: 'kai',
    walletId: 'maybank',
    amountMinor: 1000 as MinorAmount,
    currency: 'MYR' as CurrencyCode,
    type: 'expense',
    analysisExcluded: false,
    debtActivityId: null,
    categoryId,
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
  };
}

const now = new Date(2026, 9, 14, 14, 6);

describe('readActivityLink', () => {
  it('reads nothing from a plain visit', () => {
    expect(readActivityLink({}, '2026-10')).toBeNull();
  });

  it('selects a day of the chart month on the chart instead of a chip', () => {
    expect(readActivityLink({ day: '2026-10-07' }, '2026-10')).toEqual({
      query: '',
      scope: null,
      chartDay: '2026-10-07',
    });
  });

  it('makes a chip of a day the chart does not draw', () => {
    expect(readActivityLink({ day: '2026-09-14' }, '2026-10')).toEqual({
      query: '',
      scope: { kind: 'day', day: '2026-09-14' },
      chartDay: null,
    });
  });

  it('ignores a day that is not a date', () => {
    expect(readActivityLink({ day: '2026-02-30' }, '2026-10')).toBeNull();
  });

  it('scopes a category to the month the category page sent', () => {
    expect(readActivityLink({ categoryId: 'food', month: '2026-09' }, '2026-10')).toEqual({
      query: '',
      scope: { kind: 'category', categoryId: 'food', month: '2026-09' },
      chartDay: null,
    });
  });

  it('scopes a bill category to every month', () => {
    expect(readActivityLink({ categoryId: 'bills', month: 'soon' }, '2026-10')).toEqual({
      query: '',
      scope: { kind: 'category', categoryId: 'bills', month: null },
      chartDay: null,
    });
  });

  it('keeps the map link as a place with its range', () => {
    expect(readActivityLink({ placeId: 'p1', range: 'week', q: 'kopi' }, '2026-10')).toEqual({
      query: 'kopi',
      scope: { kind: 'place', placeId: 'p1', range: 'week' },
      chartDay: null,
    });
  });
});

describe('inScope', () => {
  const lunch = row('lunch', 'food', new Date(2026, 9, 3, 12));
  const septemberLunch = row('sep-lunch', 'food', new Date(2026, 8, 14, 12));
  const fuel = row('fuel', 'transport', new Date(2026, 8, 14, 9));
  const rows = [lunch, septemberLunch, fuel];
  const ids = (scope: Parameters<typeof inScope>[1]) =>
    rows.filter((transaction) => inScope(transaction, scope)).map((transaction) => transaction.id);

  it('keeps one category in one month', () => {
    expect(ids({ kind: 'category', categoryId: 'food', month: '2026-10' })).toEqual(['lunch']);
  });

  it('keeps one category in every month', () => {
    expect(ids({ kind: 'category', categoryId: 'food', month: null })).toEqual(['lunch', 'sep-lunch']);
  });

  it('keeps one local day', () => {
    expect(ids({ kind: 'day', day: '2026-09-14' })).toEqual(['sep-lunch', 'fuel']);
  });
});

describe('scopeLabel', () => {
  it('names a category month', () => {
    expect(scopeLabel({ kind: 'category', categoryId: 'food', month: '2026-10' }, 'Food & Dining', now)).toBe(
      'Food & Dining · Oct',
    );
  });

  it('names a category alone for a bill', () => {
    expect(scopeLabel({ kind: 'category', categoryId: 'food', month: null }, 'Food & Dining', now)).toBe(
      'Food & Dining',
    );
  });

  it('dates a day', () => {
    expect(scopeLabel({ kind: 'day', day: '2026-09-14' }, null, now)).toBe('Mon 14 Sep');
  });
});
