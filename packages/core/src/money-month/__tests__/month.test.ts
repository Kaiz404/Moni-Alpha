import { describe, expect, it } from 'vitest';
import type { CurrencyCode, MinorAmount, RecurringOverride, UpcomingBill } from '@repo/types';

import { type Calendar, createCalendar, type MonthKey } from '../../calendar';
import { buildReport } from '../../read-model/report';
import type {
  FinanceBudget,
  FinanceCategory,
  FinanceDebt,
  FinanceTransaction,
} from '../../read-model/types';
import {
  buildMoneyMonth,
  moneyLedger,
  firstSpendMonth,
  spendMonths,
  spendSlices,
  type MoneyLedger,
} from '../month';
import { evenPace, safePerDayAfter } from '../pace';
import { reviewSafeToSpend } from '../words';

const MYR = 'MYR' as CurrencyCode;
const KL = createCalendar('Asia/Kuala_Lumpur');
const WED_14_OCT = new Date('2026-10-14T14:06:00+08:00');
const sen = (ringgit: number) => Math.round(ringgit * 100) as MinorAmount;
const pad = (value: number) => String(value).padStart(2, '0');
/** Noon in Kuala Lumpur on a day of October 2026, or of `month`. */
const noon = (day: number, month = 10) =>
  new Date(`2026-${pad(month)}-${pad(day)}T12:00:00+08:00`).toISOString();

function category(id: string, name: string, displayOrder: number): FinanceCategory {
  return {
    id,
    userId: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    name,
    icon: null,
    color: null,
    type: 'expense',
    isActive: true,
    displayOrder,
  };
}

let nextId = 1;
function spend(
  day: number,
  ringgit: number,
  categoryId: string | null,
  over: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  return {
    id: `t${nextId++}`,
    userId: 'u',
    receiptImageUrl: null,
    metadata: {},
    updatedAt: '2026-10-01T00:00:00.000Z',
    walletId: 'maybank',
    amountMinor: sen(ringgit),
    currency: MYR,
    type: 'expense',
    analysisExcluded: false,
    debtActivityId: null,
    categoryId,
    transferToWalletId: null,
    linkedTransactionId: null,
    description: null,
    merchant: null,
    notes: null,
    transactionDate: noon(day),
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    placeId: null,
    placeCoordsAt: null,
    autoAdded: false,
    balanceCorrection: false,
    createdAt: noon(day),
    ...over,
  };
}

function budget(categoryId: string, ringgit: number, userId = 'u'): FinanceBudget {
  return {
    id: `b-${categoryId}-${userId}`,
    userId,
    categoryId,
    currency: MYR,
    amountMinor: sen(ringgit),
    period: 'monthly',
  };
}

function bill(name: string, ringgit: number, dueDate: string): UpcomingBill {
  return {
    seriesKey: `MYR|expense|${name.toLowerCase()}`,
    name,
    amountMinor: sen(ringgit),
    currency: MYR,
    dueDate,
    status: 'due',
    walletId: null,
    categoryId: null,
  };
}

const mei: FinanceDebt = {
  id: 'd1',
  userId: 'u',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  counterpartyName: 'Mei',
  direction: 'i_owe',
  currency: MYR,
  dueDate: '2026-10-20',
  note: null,
  status: 'open',
};

const food = category('food', 'Food & Dining', 1);
const transport = category('transport', 'Transport', 2);
const health = category('health', 'Health', 8);

function october(over: Partial<MoneyLedger> = {}): MoneyLedger {
  return {
    transactions: [
      spend(2, 60, 'transport'),
      spend(12, 80, 'transport'),
      spend(10, 940.2, 'food'),
      spend(13, 36, 'health'),
      spend(9, 999, 'food', { analysisExcluded: true }),
      spend(9, 50, 'food', { currency: 'USD' as CurrencyCode }),
      spend(3, 10, 'food', { transactionDate: noon(30, 9) }),
    ],
    categories: [health, transport, food],
    budgets: [budget('food', 1000), budget('transport', 120)],
    monthlyTotalMinor: sen(1800),
    bills: [
      bill('Netflix', 54.9, '2026-10-15'),
      bill('Spotify', 16.9, '2026-10-22'),
      bill('Unifi fibre', 129, '2026-10-25'),
    ],
    overrides: [],
    debts: [{ debt: mei, balanceMinor: sen(40) }],
    ...over,
  };
}

const build = (ledger: MoneyLedger, month: MonthKey = '2026-10', calendar: Calendar = KL) =>
  buildMoneyMonth(ledger, { month, currency: MYR, now: WED_14_OCT, calendar });

describe('buildMoneyMonth', () => {
  it('leaves RM443 for 18 days after bills and RM40 to Mei, as V2P-InsightsMonth reads', () => {
    const month = build(october());
    expect(month.spentMinor).toBe(sen(1116.2));
    expect(month.daysLeft).toBe(18);
    expect(month.left).toEqual({
      leftMinor: sen(443),
      daysLeft: 18,
      perDayMinor: sen(24),
      billsMinor: sen(200.8),
      debtsDue: [{ name: 'Mei', amountMinor: sen(40) }],
    });
    expect(month.words.budgetLine).toBe(
      'RM443 left for 18 days after bills and RM40 to Mei · RM24 a day',
    );
  });

  it('gives Home and Budget the same RM24 a day after bills and debts due (D1)', () => {
    const { words } = build(october());
    expect(words).toEqual({
      budgetLine: 'RM443 left for 18 days after bills and RM40 to Mei · RM24 a day',
      homeLine: 'RM443 left for 18 days · RM24 a day',
      leftLine: 'RM443 left for 18 days · RM24 a day',
      debts: 'RM40 to Mei',
    });
  });

  it('names the debt on Home only when no bill is due to carry it', () => {
    expect(build(october({ bills: [] })).words).toEqual({
      budgetLine: 'RM643 left for 18 days after RM40 to Mei · RM35 a day',
      homeLine: 'RM643 left for 18 days after RM40 to Mei · RM35 a day',
      leftLine: 'RM643 left for 18 days · RM35 a day',
      debts: 'RM40 to Mei',
    });
  });

  it('keeps "RM0 a day" on Budget and drops it on Home once less than RM1 a day is left', () => {
    expect(build(october({ monthlyTotalMinor: sen(1372) })).words).toEqual({
      budgetLine: 'RM15 left for 18 days after bills and RM40 to Mei · RM0 a day',
      homeLine: 'RM15 left for 18 days',
      leftLine: 'RM15 left for 18 days',
      debts: 'RM40 to Mei',
    });
  });

  it('keeps what was set aside on Budget over budget, and says only how far over elsewhere', () => {
    expect(build(october({ monthlyTotalMinor: sen(1336) })).words).toEqual({
      budgetLine: 'RM21 over after bills and RM40 to Mei',
      homeLine: 'RM21 over',
      leftLine: 'RM21 over',
      debts: 'RM40 to Mei',
    });
  });

  it('draws the line to today and adds up each day', () => {
    const month = build(october());
    expect(month.throughDay).toBe(14);
    expect(month.cumulative).toHaveLength(15);
    expect(month.cumulative[2]).toBe(sen(60));
    expect(month.cumulative[14]).toBe(sen(1116.2));
    expect(month.daily[9]).toBe(sen(940.2));
    expect(month.evenPaceMinor).toBe(Math.floor(sen(1800) / 31));
  });

  it('paces the month at the one even pace the charts use, and counts the days at or under it', () => {
    const month = build(october());
    expect(month.evenPaceMinor).toBe(5806);
    expect(evenPace(sen(1800), '2026-10')).toBe(5806);
    expect(month.paceDays).toEqual({ atOrUnder: 11, counted: 14 });
  });

  it('splits budgeted categories from ones spent with no budget, in display order', () => {
    const month = build(october());
    expect(month.budgeted.map((row) => [row.name, row.spentMinor, row.budgetMinor])).toEqual([
      ['Food & Dining', sen(940.2), sen(1000)],
      ['Transport', sen(140), sen(120)],
    ]);
    expect(month.unbudgeted.map((row) => [row.name, row.spentMinor])).toEqual([
      ['Health', sen(36)],
    ]);
  });

  it('says only bills when no debt is due this month, and the sum of caps stands in for a missing total', () => {
    const month = build(
      october({
        monthlyTotalMinor: null,
        debts: [{ debt: { ...mei, dueDate: '2026-11-02' }, balanceMinor: sen(40) }],
      }),
    );
    expect(month.budgetMinor).toBe(sen(1120));
    expect(month.words.budgetLine).toBe('RM197 over after bills');
  });

  it('shows a past month in full against the budget, with no bills', () => {
    const month = build(october(), '2026-09');
    expect(month.isCurrent).toBe(false);
    expect(month.throughDay).toBe(30);
    expect(month.daysLeft).toBe(0);
    expect(month.spentMinor).toBe(sen(10));
    expect(month.billsDue).toEqual([]);
    expect(month.paceDays).toEqual({ atOrUnder: 30, counted: 30 });
    expect(month.words).toEqual({
      budgetLine: 'RM1,790 under the RM1,800 budget',
      homeLine: null,
      leftLine: null,
      debts: null,
    });
  });

  it('has no sentence and no even pace without any budget', () => {
    const month = build(october({ monthlyTotalMinor: null, budgets: [] }));
    expect(month.budgetMinor).toBeNull();
    expect(month.evenPaceMinor).toBeNull();
    expect(month.paceDays).toBeNull();
    expect(month.words.budgetLine).toBeNull();
  });

  it("reads each spend's day in the calendar's zone", () => {
    const early = october({ transactions: [spend(1, 25, 'food', { transactionDate: '2026-10-01T03:00:00+08:00' })] });
    expect(build(early, '2026-10', KL).spentMinor).toBe(2500);
    expect(build(early, '2026-10', createCalendar('UTC')).spentMinor).toBe(0);
    expect(build(early, '2026-09', createCalendar('UTC')).daily[29]).toBe(2500);
  });
});

describe('moneyLedger', () => {
  const rows = (over: { monthlyBudget?: string | null; overrides?: RecurringOverride[] } = {}) => ({
    userId: 'u',
    transactions: [spend(2, 60, 'transport'), spend(3, 70, 'transport', { userId: 'someone' })],
    categoriesById: {
      food,
      transport,
      theirs: { ...category('theirs', 'Their hobby', 3), userId: 'someone' },
      salary: { ...category('salary', 'Salary', 4), type: 'income' as const },
      old: { ...category('old', 'Old hobby', 5), isActive: false },
      mine: { ...category('mine', 'Plants', 6), userId: 'u' },
    },
    budgetsById: {
      food: budget('food', 1000),
      theirs: budget('food', 500, 'someone'),
    },
    monthlyBudget: '1800.00',
    overrides: [],
    debts: [{ debt: mei, balanceMinor: sen(40) }],
    ...over,
  });

  it("keeps the user's own rows, the presets, and expense categories still in use", () => {
    const ledger = moneyLedger(rows(), WED_14_OCT, KL);
    expect(ledger.transactions.map((row) => Number(row.amountMinor))).toEqual([6000]);
    expect(ledger.categories.map((row) => row.id)).toEqual(['food', 'transport', 'mine']);
    expect(ledger.budgets.map((row) => [row.categoryId, row.userId])).toEqual([['food', 'u']]);
    expect(ledger.monthlyTotalMinor).toBe(180000);
    expect(ledger.debts).toEqual([{ debt: mei, balanceMinor: 4000 }]);
  });

  it('has no monthly total when the user set none', () => {
    expect(moneyLedger(rows({ monthlyBudget: null }), WED_14_OCT, KL).monthlyTotalMinor).toBeNull();
  });

  it("brings this month's bills, from the user's overrides", () => {
    const unifi: RecurringOverride = {
      id: '00000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-4000-8000-000000000002',
      seriesKey: 'MYR|expense|unifi',
      status: 'confirmed',
      kind: 'bill',
      expectedAmountMinor: 12900 as MinorAmount,
      expectedDay: 20,
      currency: 'MYR',
      createdAt: WED_14_OCT.toISOString(),
      updatedAt: WED_14_OCT.toISOString(),
    };
    const ledger = moneyLedger(rows({ overrides: [unifi] }), WED_14_OCT, KL);
    expect(ledger.bills.map((row) => [row.name, row.dueDate, row.status])).toEqual([
      ['unifi', '2026-10-20', 'due'],
    ]);
    expect(build(ledger).words.budgetLine).toBe(
      'RM1,571 left for 18 days after bills and RM40 to Mei · RM87 a day',
    );
  });
});

describe('safe to spend a day', () => {
  const { left } = build(october());

  it('moves by what Review approved, in whole ringgit', () => {
    expect(left!.perDayMinor).toBe(2400);
    expect(safePerDayAfter(left!, 0)).toBe(2400);
    expect(safePerDayAfter(left!, -1200)).toBe(2500);
    expect(safePerDayAfter(left!, 8000)).toBe(2000);
    expect(safePerDayAfter(left!, 44300)).toBe(0);
  });

  it("words Review's change around its approvals", () => {
    const month = build(october());
    expect(reviewSafeToSpend(month, 1200)).toEqual({
      before: 'RM25',
      after: 'RM24',
      sentence: 'RM443 left for 18 days after these.',
    });
    expect(reviewSafeToSpend(month, 0)).toEqual({
      before: null,
      after: 'RM24',
      sentence: 'RM443 left for 18 days.',
    });
    expect(
      reviewSafeToSpend(
        {
          currency: MYR,
          left: { leftMinor: sen(420), daysLeft: 18, perDayMinor: sen(23), billsMinor: sen(0), debtsDue: [] },
        },
        1200,
      ),
    ).toEqual({ before: 'RM24', after: 'RM23', sentence: 'RM420 left for 18 days after these.' });
    expect(reviewSafeToSpend(build(october({ monthlyTotalMinor: sen(1336) })), 1200)).toBeNull();
  });
});

describe('spendSlices', () => {
  const food = category('food', 'Food & Dining', 1);
  const archived = { ...category('pets', 'Pets', 2), isActive: false };

  it('adds up to the month the tab shows, with archived and uncategorised spending kept', () => {
    const transactions = [
      spend(2, 40.1, 'food'),
      spend(3, 9.9, 'food'),
      spend(4, 25, 'pets'),
      spend(5, 12.5, null),
      spend(6, 7, 'deleted-long-ago'),
      spend(7, 100, 'food', { type: 'income' }),
      spend(8, 100, 'food', { analysisExcluded: true }),
      spend(9, 100, 'food', { currency: 'USD' as CurrencyCode }),
    ];
    const slices = spendSlices(transactions, '2026-10', MYR, [food, archived], KL);
    expect(slices.map((slice) => [slice.categoryId, slice.name, slice.spentMinor])).toEqual([
      ['food', 'Food & Dining', 5000],
      ['pets', 'Pets', 2500],
      [null, 'No category', 1950],
    ]);
    const month = build({
      transactions,
      categories: [food],
      budgets: [],
      monthlyTotalMinor: null,
      bills: [],
      overrides: [],
      debts: [],
    });
    expect(month.spentMinor).toBe(9450);
    expect(slices.reduce((sum, slice) => sum + Number(slice.spentMinor), 0)).toBe(9450);
  });

  it('has nothing for a month with no spending', () => {
    expect(spendSlices([spend(2, 40, 'food')], '2026-09', MYR, [food], KL)).toEqual([]);
  });
});

describe('firstSpendMonth', () => {
  it('starts at the oldest month with spending in the currency', () => {
    const usdInAugust = spend(1, 5, 'food', { currency: 'USD' as CurrencyCode, transactionDate: noon(1, 8) });
    expect(firstSpendMonth([...october().transactions, usdInAugust], MYR, WED_14_OCT, KL)).toBe('2026-09');
  });

  it('is this month when nothing was spent', () => {
    expect(firstSpendMonth([], MYR, WED_14_OCT, KL)).toBe('2026-10');
  });
});

describe('spendMonths', () => {
  it('lists this month first, then earlier months with spend', () => {
    expect(spendMonths(october().transactions, MYR, WED_14_OCT, KL)).toEqual([
      { month: '2026-10', spentMinor: sen(1116.2) },
      { month: '2026-09', spentMinor: sen(10) },
    ]);
  });
});

describe('buildMoneyMonth against the report', () => {
  it('spends what the report category rows add up to in that month', () => {
    const sep = (day: number) => ({ transactionDate: noon(day, 9) });
    const categories = [category('food', 'Food & Dining', 0), { ...category('old', 'Old hobby', 1), isActive: false }];
    const transactions = [
      spend(2, 100, 'food'),
      spend(3, 50.5, 'food'),
      spend(4, 20, 'old'),
      spend(5, 9.9, null),
      spend(6, 4200, null, { type: 'income' }),
      spend(1, 30, 'food', sep(1)),
      spend(14, 10, 'food', sep(14)),
      spend(20, 500, 'food', sep(20)),
      spend(2, 4000, null, { ...sep(2), type: 'income' }),
      spend(7, 300, null, { type: 'transfer', transferToWalletId: 'tng' }),
      spend(8, 77, null, { analysisExcluded: true, balanceCorrection: true }),
      spend(8, 88, null, { type: 'income', analysisExcluded: true, balanceCorrection: true }),
      spend(9, 66, null, { analysisExcluded: true, debtActivityId: 'a1' }),
      spend(9, 55, null, { type: 'income', analysisExcluded: true, debtActivityId: 'a2' }),
      spend(9, 44, null, { debtActivityId: 'a3' }),
      spend(10, 999, 'food', { currency: 'USD' as CurrencyCode }),
    ];
    for (const [month, spent] of [
      ['2026-10', 18040],
      ['2026-09', 54000],
    ] as const) {
      const report = buildReport({ month, currency: MYR, transactions, categories, aliases: [], calendar: KL });
      expect(report.categories.reduce((sum, row) => sum + row.spentMinor, 0)).toBe(spent);
      const moneyMonth = build(
        {
          transactions,
          categories,
          budgets: [],
          monthlyTotalMinor: null,
          bills: [],
          overrides: [],
          debts: [],
        },
        month,
      );
      expect(moneyMonth.spentMinor).toBe(spent);
    }
  });
});
