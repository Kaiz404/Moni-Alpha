import type { CurrencyCode, MinorAmount } from '@repo/types';

import { inScope, readActivityLink } from '@/components/activity/activity-link';
import { filterActivity } from '@/lib/finance/activity-filter';
import { buildBudgetMonth } from '@/lib/finance/budget-month';
import type { FinanceCategory, FinanceTransaction } from '@/lib/finance/types';
import {
  buildReport,
  changePhrase,
  comparisonFor,
  periodRange,
  rangeLabel,
  type ReportPeriod,
} from '@/lib/reports/report';
import { categoryLink, merchantLink } from '@/components/reports/report-link';
import { trendGeometry } from '@/lib/reports/trend-geometry';

const MYR = 'MYR' as CurrencyCode;
const NOW = new Date(2026, 9, 14, 12, 0);

let nextId = 1;
function txn(
  date: Date,
  type: FinanceTransaction['type'],
  ringgit: number,
  over: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  const iso = date.toISOString();
  return {
    id: `t${nextId++}`,
    userId: 'kai',
    walletId: 'maybank',
    amountMinor: Math.round(ringgit * 100) as MinorAmount,
    currency: MYR,
    type,
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: null,
    transferToWalletId: null,
    linkedTransactionId: null,
    description: null,
    merchant: null,
    notes: null,
    transactionDate: iso,
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    autoAdded: false,
    balanceCorrection: false,
    createdAt: iso,
    ...over,
  };
}

function category(id: string, name: string, over: Partial<FinanceCategory> = {}): FinanceCategory {
  return {
    id,
    userId: null,
    name,
    icon: 'silverware',
    type: 'expense',
    color: '#F1A399',
    isActive: true,
    displayOrder: 0,
    ...over,
  };
}

const oct = (day: number) => new Date(2026, 9, day, 9, 0);
const sep = (day: number) => new Date(2026, 8, day, 9, 0);

const FOOD = category('food', 'Food & Dining');
const OLD = category('old', 'Old hobby', { isActive: false });
const CATEGORIES = [FOOD, OLD];

const TRANSACTIONS = [
  txn(oct(2), 'expense', 100, { categoryId: 'food', merchant: 'GRAB*1234 KL' }),
  txn(oct(3), 'expense', 50.5, { categoryId: 'food', merchant: 'Grab A-98QZ' }),
  txn(oct(4), 'expense', 20, { categoryId: 'old', merchant: 'Kedai ABC' }),
  txn(oct(5), 'expense', 9.9, { description: 'Parking' }),
  txn(oct(6), 'income', 4200, { description: 'Salary' }),
  txn(sep(1), 'expense', 30, { categoryId: 'food', merchant: 'Grab' }),
  txn(sep(14), 'expense', 10, { categoryId: 'food', merchant: 'Grab' }),
  txn(sep(20), 'expense', 500, { categoryId: 'food', merchant: 'Grab' }),
  txn(sep(2), 'income', 4000),
  // None of these is spending or money in.
  txn(oct(7), 'transfer', 300, { transferToWalletId: 'tng' }),
  txn(oct(8), 'expense', 77, { analysisExcluded: true, balanceCorrection: true }),
  txn(oct(8), 'income', 88, { analysisExcluded: true, balanceCorrection: true }),
  txn(oct(9), 'expense', 66, { analysisExcluded: true, debtActivityId: 'a1' }),
  txn(oct(9), 'income', 55, { analysisExcluded: true, debtActivityId: 'a2' }),
  txn(oct(9), 'expense', 44, { debtActivityId: 'a3' }),
  txn(oct(10), 'expense', 999, { currency: 'USD' as CurrencyCode, categoryId: 'food' }),
];

function report(period: ReportPeriod) {
  return buildReport({
    period,
    now: NOW,
    currency: MYR,
    transactions: TRANSACTIONS,
    categories: CATEGORIES,
    aliases: [{ rawKey: 'grab', displayName: 'Grab ride' }],
  });
}

const OCTOBER: ReportPeriod = { kind: 'month', month: '2026-10' };

describe('buildReport for a month', () => {
  it('totals income against spending, leaving out transfers, corrections and debt cash', () => {
    const october = report(OCTOBER);
    expect(october.spentMinor).toBe(18040);
    expect(october.inMinor).toBe(420000);
    expect(october.range).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('lists categories by spend with the same days of last month, archived ones included', () => {
    expect(
      report(OCTOBER).categories.map((row) => [
        row.categoryId,
        row.name,
        row.spentMinor,
        row.previousMinor,
      ]),
    ).toEqual([
      ['food', 'Food & Dining', 15050, 4000],
      ['old', 'Old hobby', 2000, 0],
      [null, 'Uncategorized', 990, 0],
    ]);
  });

  it('adds its category rows up to its total', () => {
    const october = report(OCTOBER);
    expect(october.categories.reduce((sum, row) => sum + row.spentMinor, 0)).toBe(
      october.spentMinor,
    );
  });

  it('names merchants with the merchant names, biggest first', () => {
    const october = report(OCTOBER);
    expect(
      october.merchants.map((row) => [row.name, row.payments, row.spentMinor, row.categoryId]),
    ).toEqual([
      ['Grab ride', 2, 15050, 'food'],
      ['Kedai ABC', 1, 2000, 'old'],
      ['Parking', 1, 990, null],
    ]);
    expect(october.merchantCount).toBe(3);
  });

  it('draws six months ending at the period, each with spending and money in', () => {
    expect(report(OCTOBER).trend).toEqual([
      { month: '2026-05', spentMinor: 0, inMinor: 0 },
      { month: '2026-06', spentMinor: 0, inMinor: 0 },
      { month: '2026-07', spentMinor: 0, inMinor: 0 },
      { month: '2026-08', spentMinor: 0, inMinor: 0 },
      { month: '2026-09', spentMinor: 54000, inMinor: 400000 },
      { month: '2026-10', spentMinor: 18040, inMinor: 420000 },
    ]);
  });
});

describe('the report matches the other screens', () => {
  const budget = (month: string) =>
    buildBudgetMonth({
      month,
      now: NOW,
      currency: MYR,
      transactions: TRANSACTIONS,
      categories: CATEGORIES,
      budgets: [],
      monthlyTotalMinor: null,
      bills: [],
      debts: [],
    });

  it('spends the same as Budget and Home in every month', () => {
    expect(report(OCTOBER).spentMinor).toBe(budget('2026-10').spentMinor);
    expect(report({ kind: 'month', month: '2026-09' }).spentMinor).toBe(
      budget('2026-09').spentMinor,
    );
  });

  it('leaves debt cash and excluded rows out of what it spends and earns, and compares with last month by now', () => {
    const october = report(OCTOBER);
    expect(october.spentMinor).toBe(18040);
    expect(october.inMinor).toBe(420000);
    expect(october.previousSpentMinor).toBe(4000);
  });

  it('opens each category row on the rows that add up to it in Activity', () => {
    const october = report(OCTOBER);
    for (const row of october.categories) {
      const link = readActivityLink(categoryLink(row.categoryId, october.range), '2026-10');
      const scope = link?.scope;
      if (scope?.kind !== 'category') throw new Error('expected a category scope');
      const shown = filterActivity(
        TRANSACTIONS.filter((transaction) => inScope(transaction, scope)),
        {
          query: '',
          walletId: null,
          mainCurrency: MYR,
          kind: 'all',
          day: null,
          categoryNames: {},
        },
      );
      expect(shown.reduce((sum, transaction) => sum + Number(transaction.amountMinor), 0)).toBe(
        row.spentMinor,
      );
    }
  });
});

describe('category and merchant links', () => {
  it('keeps the month when the period stays inside one', () => {
    expect(categoryLink('food', { from: '2026-10-01', to: '2026-10-31' })).toEqual({
      categoryId: 'food',
      month: '2026-10',
    });
  });

  it('drops the month for a period across months', () => {
    expect(categoryLink('food', { from: '2026-09-20', to: '2026-10-05' })).toEqual({
      categoryId: 'food',
    });
  });

  it('gives spending with no category its own filter', () => {
    expect(categoryLink(null, { from: '2026-10-01', to: '2026-10-31' })).toEqual({
      categoryId: 'none',
      month: '2026-10',
    });
  });

  it('searches for a merchant by its name', () => {
    expect(merchantLink('Grab ride')).toEqual({ q: 'Grab ride' });
  });
});

describe('a custom period', () => {
  const custom: ReportPeriod = { kind: 'custom', from: '2026-10-02', to: '2026-10-05' };

  it('counts only its days', () => {
    const period = report(custom);
    expect(period.spentMinor).toBe(18040);
    expect(period.inMinor).toBe(0);
  });

  it('is measured against the same number of days just before it', () => {
    expect(comparisonFor(custom, NOW)).toEqual({
      range: { from: '2026-09-28', to: '2026-10-01' },
      label: 'the 4 days before',
    });
  });

  it('reads the same with its ends swapped', () => {
    expect(periodRange({ kind: 'custom', from: '2026-10-05', to: '2026-10-02' })).toEqual({
      from: '2026-10-02',
      to: '2026-10-05',
    });
  });

  it('crosses a month end', () => {
    expect(report({ kind: 'custom', from: '2026-09-14', to: '2026-10-02' }).spentMinor).toBe(61000);
  });

  it('ends its trend at its last month', () => {
    expect(report({ kind: 'custom', from: '2026-08-01', to: '2026-09-30' }).trend.at(-1)?.month).toBe(
      '2026-09',
    );
  });

  it('has words for its days', () => {
    expect(rangeLabel({ from: '2026-10-02', to: '2026-10-05' }, NOW)).toBe('Fri 2 Oct to Mon 5 Oct');
    expect(rangeLabel({ from: '2026-10-02', to: '2026-10-02' }, NOW)).toBe('Fri 2 Oct');
  });
});

describe('comparisonFor', () => {
  it('holds a past month against the whole month before', () => {
    expect(comparisonFor({ kind: 'month', month: '2026-09' }, NOW)).toEqual({
      range: { from: '2026-08-01', to: '2026-08-31' },
      label: 'Aug',
    });
  });

  it('holds the running month against the same days, clipped to a shorter month', () => {
    expect(comparisonFor({ kind: 'month', month: '2026-03' }, new Date(2026, 2, 31))).toEqual({
      range: { from: '2026-02-01', to: '2026-02-28' },
      label: 'Feb by now',
    });
  });

  it('crosses a year', () => {
    expect(comparisonFor({ kind: 'month', month: '2026-01' }, NOW).range).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });
});

describe('changePhrase', () => {
  const comparison = { range: { from: '', to: '' }, label: 'Sep by now' };

  it('says more, less, and same', () => {
    expect(changePhrase(15050, 4000, comparison, 'MYR')).toBe('RM110.50 more than Sep by now');
    expect(changePhrase(1000, 4000, comparison, 'MYR')).toBe('RM30.00 less than Sep by now');
    expect(changePhrase(4000, 4000, comparison, 'MYR')).toBe('Same as Sep by now');
  });

  it('says nothing when there was nothing before', () => {
    expect(changePhrase(4000, 0, comparison, 'MYR')).toBeNull();
  });
});

describe('trendGeometry', () => {
  const trend = [
    { month: '2026-09', spentMinor: 50000 as MinorAmount, inMinor: 100000 as MinorAmount },
    { month: '2026-10', spentMinor: 1 as MinorAmount, inMinor: 0 as MinorAmount },
  ];

  it('lays out a pair of bars in each slot on one axis', () => {
    const geometry = trendGeometry(trend, 350, '2026-10', 'MYR');
    expect(geometry.slot).toBe(150);
    expect(geometry.topLabel).toBe('RM1,000');
    expect(geometry.zeroLabel).toBe('RM0');
    expect(geometry.slots[0]).toEqual({
      month: '2026-09',
      x: 50,
      spentX: 112,
      inX: 126,
      spentHeight: 48.625,
      inHeight: 97.25,
      label: 'Sep',
      selected: false,
    });
  });

  it('keeps a tiny amount visible, draws nothing for zero, and marks the chosen month', () => {
    const october = trendGeometry(trend, 350, '2026-10', 'MYR').slots[1];
    expect(october.spentHeight).toBe(6);
    expect(october.inHeight).toBe(0);
    expect(october.selected).toBe(true);
  });

  it('shortens a five-figure axis label', () => {
    const big = [{ month: '2026-10', spentMinor: 1234500 as MinorAmount, inMinor: 0 as MinorAmount }];
    expect(trendGeometry(big, 350, null, 'MYR').topLabel).toBe('RM13k');
  });
});
