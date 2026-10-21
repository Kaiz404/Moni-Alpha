import type { CurrencyCode, MinorAmount } from '@repo/types';

import { balanceMonth, categoryMonths, spendingMonth } from '@/lib/finance/activity-series';
import type { FinanceTransaction, FinanceWallet } from '@/lib/finance/types';

const MYR = 'MYR' as CurrencyCode;
const now = new Date(2026, 9, 3, 14, 6);

function txn(
  date: Date,
  type: FinanceTransaction['type'],
  amountMinor: number,
  over: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  return {
    id: `${date.toISOString()}-${amountMinor}`,
    userId: 'kai',
    walletId: 'maybank',
    amountMinor: amountMinor as MinorAmount,
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
    transactionDate: date.toISOString(),
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    autoAdded: false,
    balanceCorrection: false,
    createdAt: date.toISOString(),
    ...over,
  };
}

function wallet(id: string, currency: string, initial: number): FinanceWallet {
  return {
    id,
    userId: 'kai',
    name: id,
    type: 'bank',
    currency: currency as CurrencyCode,
    initialBalanceMinor: initial as MinorAmount,
    color: null,
    icon: null,
    cardStyleId: null,
    isActive: true,
    displayOrder: 0,
    balanceConfirmedAt: null,
  };
}

const paced = {
  evenPaceMinor: 5806 as MinorAmount,
  left: {
    leftMinor: 156000 as MinorAmount,
    daysLeft: 29,
    perDayMinor: 5300 as MinorAmount,
    billsMinor: 0 as MinorAmount,
    debtsDue: [],
  },
};

describe('spendingMonth', () => {
  it("sums each day so far, compares with last month by now, and takes the Budget tab's pace", () => {
    const month = spendingMonth(
      [
        txn(new Date(2026, 9, 1, 12), 'expense', 1250),
        txn(new Date(2026, 9, 3, 9), 'expense', 4590),
        txn(new Date(2026, 9, 3, 10), 'expense', 5000, { analysisExcluded: true }),
        txn(new Date(2026, 9, 2, 10), 'expense', 4000, { debtActivityId: 'mei' }),
        txn(new Date(2026, 9, 1, 9), 'income', 420000),
        txn(new Date(2026, 8, 2, 9), 'expense', 9000),
        txn(new Date(2026, 8, 20, 9), 'expense', 7000),
        txn(new Date(2026, 9, 2, 9), 'expense', 1000, { currency: 'USD' as CurrencyCode }),
      ],
      paced,
      MYR,
      now,
    );
    expect(month).toEqual({
      days: [
        { key: '2026-10-01', day: 1, spentMinor: 1250 },
        { key: '2026-10-02', day: 2, spentMinor: 0 },
        { key: '2026-10-03', day: 3, spentMinor: 4590 },
      ],
      daysInMonth: 31,
      spentMinor: 5840,
      inMinor: 420000,
      lastMonthByNowMinor: 9000,
      evenPaceMinor: 5806,
      safeToSpendMinor: 5300,
    });
  });

  it('has no even pace without a budget', () => {
    const month = spendingMonth([], { evenPaceMinor: null, left: null }, MYR, now);
    expect([month.evenPaceMinor, month.safeToSpendMinor]).toEqual([null, null]);
  });
});

describe('categoryMonths', () => {
  it('runs a total per category through today, leaving other currencies and months out', () => {
    expect(
      categoryMonths(
        [
          txn(new Date(2026, 9, 1, 12), 'expense', 1250, { categoryId: 'food' }),
          txn(new Date(2026, 9, 3, 9), 'expense', 4590, { categoryId: 'food' }),
          txn(new Date(2026, 9, 2, 9), 'expense', 3040, { categoryId: 'transport' }),
          txn(new Date(2026, 9, 2, 9), 'expense', 999, {
            categoryId: 'food',
            currency: 'USD' as CurrencyCode,
          }),
          txn(new Date(2026, 8, 30, 9), 'expense', 777, { categoryId: 'food' }),
          txn(new Date(2026, 9, 1, 9), 'income', 420000, { categoryId: 'salary' }),
        ],
        MYR,
        now,
      ),
    ).toEqual({
      food: [1250, 1250, 5840],
      transport: [0, 3040, 3040],
      salary: [420000, 420000, 420000],
    });
  });
});

describe('balanceMonth', () => {
  it('carries the opening balance into closing balances of the MYR wallets only', () => {
    const month = balanceMonth(
      [wallet('maybank', 'MYR', 300000), wallet('cash', 'MYR', 5000), wallet('wise', 'USD', 12000)],
      [
        txn(new Date(2026, 8, 28, 9), 'expense', 10000),
        txn(new Date(2026, 9, 1, 9), 'expense', 2000),
        txn(new Date(2026, 9, 3, 9), 'transfer', 10000, { transferToWalletId: 'cash' }),
        txn(new Date(2026, 9, 3, 9), 'income', 500, { walletId: 'cash' }),
        txn(new Date(2026, 9, 2, 9), 'expense', 700, { walletId: 'wise' }),
      ],
      MYR,
      now,
    );
    expect(month.days.map((day) => day.balanceMinor)).toEqual([293000, 293000, 293500]);
    expect(month.daysInMonth).toBe(31);
  });
});
