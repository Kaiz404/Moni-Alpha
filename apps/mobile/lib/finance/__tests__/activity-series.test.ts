import type { CurrencyCode, MinorAmount } from '@repo/types';

import { categoryMonths } from '@/lib/finance/activity-series';
import type { FinanceTransaction } from '@/lib/finance/types';

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
