import type { CurrencyCode, MinorAmount } from '@repo/types';

import { buildBudgetMonth } from '@/lib/finance/budget-month';
import type { FinanceCategory, FinanceTransaction } from '@/lib/finance/types';
import {
  buildReport,
  changePhrase,
  comparisonFor,
  countsAsIncome,
  readSpendingParams,
  spendingChange,
  spendingParams,
  spendingRows,
  totalMinor,
} from '@/lib/reports/report';

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

const ALIASES = [{ rawKey: 'grab', displayName: 'Grab ride' }];

function report(month: string) {
  return buildReport({
    month,
    now: NOW,
    currency: MYR,
    transactions: TRANSACTIONS,
    categories: CATEGORIES,
    aliases: ALIASES,
  });
}

const rows = (scope: Parameters<typeof spendingRows>[0], month = '2026-10') =>
  spendingRows(scope, month, TRANSACTIONS, MYR, ALIASES);

/** Date and amount, newest first, which is all a list of payments has to get right. */
const shown = (transactions: FinanceTransaction[]) =>
  transactions.map((row) => [new Date(row.transactionDate).getDate(), row.amountMinor]);

describe('buildReport for a month', () => {
  it('lists categories by spend with the same days of last month, archived ones included', () => {
    expect(
      report('2026-10').categories.map((row) => [
        row.categoryId,
        row.name,
        row.spentMinor,
        row.previousMinor,
      ]),
    ).toEqual([
      ['food', 'Food & Dining', 15050, 4000],
      ['old', 'Old hobby', 2000, 0],
      [null, 'No category', 990, 0],
    ]);
  });

  it('holds a past month against the whole month before', () => {
    expect(report('2026-09').categories[0].spentMinor).toBe(54000);
    expect(report('2026-09').comparison.label).toBe('Aug');
  });

  it('adds its category rows up to what Budget and Home spend in that month', () => {
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
    for (const [month, spent] of [
      ['2026-10', 18040],
      ['2026-09', 54000],
    ] as const) {
      expect(report(month).categories.reduce((sum, row) => sum + row.spentMinor, 0)).toBe(spent);
      expect(budget(month).spentMinor).toBe(spent);
    }
  });

  it('names merchants with the merchant names, biggest first, in the colours of their newest payment', () => {
    const october = report('2026-10');
    expect(
      october.merchants.map((row) => [row.name, row.payments, row.spentMinor, row.icon, row.color]),
    ).toEqual([
      ['Grab ride', 2, 15050, 'silverware', '#F1A399'],
      ['Kedai ABC', 1, 2000, 'silverware', '#F1A399'],
      ['Parking', 1, 990, null, null],
    ]);
    expect(october.merchantCount).toBe(3);
  });
});

describe('spendingRows', () => {
  it('lists a category newest first, leaving out debt cash, excluded rows and other currencies', () => {
    expect(shown(rows({ kind: 'category', categoryId: 'food' }))).toEqual([
      [3, 5050],
      [2, 10000],
    ]);
  });

  it('lists spending with no category, without its debt cash, corrections or transfers', () => {
    expect(shown(rows({ kind: 'category', categoryId: null }))).toEqual([[5, 990]]);
  });

  it('finds a merchant under the name the user gave it, across every bank code', () => {
    const grab = rows({ kind: 'merchant', name: 'Grab ride' });
    expect(shown(grab)).toEqual([
      [3, 5050],
      [2, 10000],
    ]);
    expect(grab.map((row) => row.merchant)).toEqual(['Grab ride', 'Grab ride']);
    expect(rows({ kind: 'merchant', name: 'GRAB*1234 KL' })).toEqual([]);
  });

  it('finds a merchant named only by its description', () => {
    expect(shown(rows({ kind: 'merchant', name: 'Parking' }))).toEqual([[5, 990]]);
  });

  it('narrows a merchant to one category when the row it came from did', () => {
    const lunches = [
      txn(oct(2), 'expense', 10, { categoryId: 'food', merchant: 'Kedai ABC' }),
      txn(oct(3), 'expense', 30, { categoryId: 'old', merchant: 'Kedai ABC' }),
    ];
    const scoped = (categoryId?: string) =>
      spendingRows({ kind: 'merchant', name: 'Kedai ABC', categoryId }, '2026-10', lunches, MYR, []);
    expect(totalMinor(scoped('food'))).toBe(1000);
    expect(totalMinor(scoped())).toBe(4000);
  });

  it('lists one day of spending', () => {
    expect(shown(rows({ kind: 'day', day: '2026-10-03' }))).toEqual([[3, 5050]]);
    expect(rows({ kind: 'day', day: '2026-10-06' })).toEqual([]);
  });

  it('stays in its month', () => {
    expect(shown(rows({ kind: 'category', categoryId: 'food' }, '2026-09'))).toEqual([
      [20, 50000],
      [14, 1000],
      [1, 3000],
    ]);
  });

  it('adds up to the amount on every row of the report, in any month', () => {
    for (const month of ['2026-10', '2026-09']) {
      const { categories, merchants } = report(month);
      for (const row of categories) {
        expect(totalMinor(rows({ kind: 'category', categoryId: row.categoryId }, month))).toBe(
          row.spentMinor,
        );
      }
      for (const row of merchants) {
        expect(totalMinor(rows({ kind: 'merchant', name: row.name }, month))).toBe(row.spentMinor);
      }
    }
  });
});

describe('spendingChange', () => {
  const change = (scope: Parameters<typeof spendingRows>[0], month = '2026-10') =>
    spendingChange(scope, month, NOW, TRANSACTIONS, MYR, ALIASES);

  it('reads the same as the row the page opened from', () => {
    expect(change({ kind: 'category', categoryId: 'food' })).toBe('RM110.50 more than Sep by now');
    expect(change({ kind: 'merchant', name: 'Grab ride' })).toBe('RM110.50 more than Sep by now');
  });

  it('holds a past month against the whole month before', () => {
    const lastAugust = txn(new Date(2026, 7, 31, 9, 0), 'expense', 40, { categoryId: 'food' });
    expect(
      spendingChange(
        { kind: 'category', categoryId: 'food' },
        '2026-09',
        NOW,
        [...TRANSACTIONS, lastAugust],
        MYR,
        ALIASES,
      ),
    ).toBe('RM500.00 more than Aug');
  });

  it('has nothing to say about one day, or about a month with nothing before it', () => {
    expect(change({ kind: 'day', day: '2026-10-03' })).toBeNull();
    expect(change({ kind: 'category', categoryId: 'old' })).toBeNull();
  });
});

describe('spending params', () => {
  it.each([
    [{ kind: 'category', categoryId: 'food' }, { month: '2026-10', categoryId: 'food' }],
    [{ kind: 'category', categoryId: null }, { month: '2026-10', categoryId: 'none' }],
    [{ kind: 'merchant', name: 'A&W' }, { month: '2026-10', merchant: 'A&W' }],
    [
      { kind: 'merchant', name: 'Grab', categoryId: 'food' },
      { month: '2026-10', merchant: 'Grab', categoryId: 'food' },
    ],
    [{ kind: 'day', day: '2026-10-03' }, { month: '2026-10', day: '2026-10-03' }],
  ] as const)('carry %j and read back', (scope, params) => {
    expect(spendingParams(scope, '2026-10')).toEqual(params);
    expect(readSpendingParams(params, '2026-11')).toEqual({ scope, month: '2026-10' });
  });

  it('falls back to this month for a bad month', () => {
    expect(readSpendingParams({ month: 'nonsense', categoryId: 'food' }, '2026-11')?.month).toBe(
      '2026-11',
    );
  });

  it('takes the month from a day', () => {
    expect(readSpendingParams({ day: '2026-09-03' }, '2026-11')?.month).toBe('2026-09');
  });

  it('reads nothing when they name no spending', () => {
    expect(readSpendingParams({}, '2026-11')).toBeNull();
    expect(readSpendingParams({ day: '2026-13-40' }, '2026-11')).toBeNull();
    expect(readSpendingParams({ month: '2026-10' }, '2026-11')).toBeNull();
  });
});

describe('countsAsIncome', () => {
  it('counts income only, leaving out corrections, debt cash and other currencies', () => {
    expect(TRANSACTIONS.filter((row) => countsAsIncome(row, MYR)).map((row) => row.amountMinor)).toEqual(
      [420000, 400000],
    );
  });
});

describe('comparisonFor', () => {
  it('holds a past month against the whole month before', () => {
    expect(comparisonFor('2026-09', NOW)).toEqual({
      range: { from: '2026-08-01', to: '2026-08-31' },
      label: 'Aug',
    });
  });

  it('holds the running month against the same days, clipped to a shorter month', () => {
    expect(comparisonFor('2026-03', new Date(2026, 2, 31))).toEqual({
      range: { from: '2026-02-01', to: '2026-02-28' },
      label: 'Feb by now',
    });
  });

  it('crosses a year', () => {
    expect(comparisonFor('2026-01', NOW).range).toEqual({
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
