import type { CurrencyCode, MinorAmount, UpcomingBill } from '@repo/types';

import {
  buildBudgetMonth,
  leftSentence,
  spendMonths,
  type BudgetMonthInput,
} from '../budget-month';
import type {
  FinanceBudget,
  FinanceCategory,
  FinanceDebt,
  FinanceTransaction,
} from '../types';

const MYR = 'MYR' as CurrencyCode;
const WED_14_OCT = new Date(2026, 9, 14, 14, 6);
const sen = (ringgit: number) => Math.round(ringgit * 100) as MinorAmount;

function category(id: string, name: string, displayOrder: number): FinanceCategory {
  return {
    id,
    userId: null,
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
    transactionDate: new Date(2026, 9, day, 12).toISOString(),
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    autoAdded: false,
    createdAt: new Date(2026, 9, day, 12).toISOString(),
    ...over,
  };
}

function budget(categoryId: string, ringgit: number): FinanceBudget {
  return {
    id: `b-${categoryId}`,
    userId: 'u',
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
  };
}

const mei: FinanceDebt = {
  id: 'd1',
  userId: 'u',
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

function october(over: Partial<BudgetMonthInput> = {}): BudgetMonthInput {
  return {
    month: '2026-10',
    now: WED_14_OCT,
    currency: MYR,
    transactions: [
      spend(2, 60, 'transport'),
      spend(12, 80, 'transport'),
      spend(10, 940.2, 'food'),
      spend(13, 36, 'health'),
      spend(9, 999, 'food', { analysisExcluded: true }),
      spend(9, 50, 'food', { currency: 'USD' as CurrencyCode }),
      spend(3, 10, 'food', { transactionDate: new Date(2026, 8, 30, 12).toISOString() }),
    ],
    categories: [health, transport, food],
    budgets: [budget('food', 1000), budget('transport', 120)],
    monthlyTotalMinor: sen(1800),
    bills: [
      bill('Netflix', 54.9, '2026-10-15'),
      bill('Spotify', 16.9, '2026-10-22'),
      bill('Unifi fibre', 129, '2026-10-25'),
    ],
    debts: [{ debt: mei, balanceMinor: sen(40) }],
    ...over,
  };
}

describe('buildBudgetMonth', () => {
  it('leaves RM443 for 18 days after bills and RM40 to Mei, as V2P-InsightsMonth reads', () => {
    const month = buildBudgetMonth(october());
    expect(month.spentMinor).toBe(sen(1116.2));
    expect(month.left).toEqual({
      leftMinor: sen(443),
      daysLeft: 18,
      perDayMinor: sen(24),
      billsMinor: sen(200.8),
      debtsDue: [{ name: 'Mei', amountMinor: sen(40) }],
    });
    expect(leftSentence(month)).toBe(
      'RM443 left for 18 days after bills and RM40 to Mei · RM24 a day',
    );
  });

  it('draws the line to today and adds up each day', () => {
    const month = buildBudgetMonth(october());
    expect(month.throughDay).toBe(14);
    expect(month.cumulative).toHaveLength(15);
    expect(month.cumulative[2]).toBe(sen(60));
    expect(month.cumulative[14]).toBe(sen(1116.2));
    expect(month.daily[9]).toBe(sen(940.2));
    expect(month.evenPaceMinor).toBe(Math.floor(sen(1800) / 31));
  });

  it('splits budgeted categories from ones spent with no budget, in display order', () => {
    const month = buildBudgetMonth(october());
    expect(month.budgeted.map((row) => [row.name, row.spentMinor, row.budgetMinor])).toEqual([
      ['Food & Dining', sen(940.2), sen(1000)],
      ['Transport', sen(140), sen(120)],
    ]);
    expect(month.unbudgeted.map((row) => [row.name, row.spentMinor])).toEqual([
      ['Health', sen(36)],
    ]);
  });

  it('says only bills when no debt is due this month, and the sum of caps stands in for a missing total', () => {
    const month = buildBudgetMonth(
      october({
        monthlyTotalMinor: null,
        debts: [{ debt: { ...mei, dueDate: '2026-11-02' }, balanceMinor: sen(40) }],
      }),
    );
    expect(month.budgetMinor).toBe(sen(1120));
    expect(leftSentence(month)).toBe('RM197 over after bills');
  });

  it('shows a past month in full against the budget, with no bills', () => {
    const month = buildBudgetMonth(october({ month: '2026-09' }));
    expect(month.isCurrent).toBe(false);
    expect(month.throughDay).toBe(30);
    expect(month.spentMinor).toBe(sen(10));
    expect(month.billsDue).toEqual([]);
    expect(leftSentence(month)).toBe('RM1,790 under the RM1,800 budget');
  });

  it('has no sentence and no even pace without any budget', () => {
    const month = buildBudgetMonth(october({ monthlyTotalMinor: null, budgets: [] }));
    expect(month.budgetMinor).toBeNull();
    expect(month.evenPaceMinor).toBeNull();
    expect(leftSentence(month)).toBeNull();
  });
});

describe('spendMonths', () => {
  it('lists this month first, then earlier months with spend', () => {
    expect(spendMonths(october().transactions, MYR, WED_14_OCT)).toEqual([
      { month: '2026-10', spentMinor: sen(1116.2) },
      { month: '2026-09', spentMinor: sen(10) },
    ]);
  });
});
