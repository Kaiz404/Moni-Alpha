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

describe('readActivityLink', () => {
  it('reads nothing from a plain visit', () => {
    expect(readActivityLink({})).toBeNull();
  });

  it('keeps a search from a link', () => {
    expect(readActivityLink({ q: 'Grab ride' })).toEqual({
      query: 'Grab ride',
      scope: null,
    });
  });

  it('scopes a category to the month the category page sent', () => {
    expect(readActivityLink({ categoryId: 'food', month: '2026-09' })).toEqual({
      query: '',
      scope: { kind: 'category', categoryId: 'food', month: '2026-09' },
    });
  });

  it('scopes a bill category to every month', () => {
    expect(readActivityLink({ categoryId: 'bills', month: 'soon' })).toEqual({
      query: '',
      scope: { kind: 'category', categoryId: 'bills', month: null },
    });
  });

  it('keeps the map link as a place with its range', () => {
    expect(readActivityLink({ placeId: 'p1', range: 'week', q: 'kopi' })).toEqual({
      query: 'kopi',
      scope: { kind: 'place', placeId: 'p1', range: 'week' },
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
});

describe('scopeLabel', () => {
  it('names a category month', () => {
    expect(scopeLabel({ kind: 'category', categoryId: 'food', month: '2026-10' }, 'Food & Dining')).toBe(
      'Food & Dining · Oct',
    );
  });

  it('names a category alone for a bill', () => {
    expect(scopeLabel({ kind: 'category', categoryId: 'food', month: null }, 'Food & Dining')).toBe(
      'Food & Dining',
    );
  });
});
