import { describe, expect, it } from 'vitest';
import type { CurrencyCode, MinorAmount } from '@repo/types';

import { categoryMonths } from '../activity-series';
import type { FinanceTransaction } from '../types';
import { createCalendar } from '../../calendar';

const MYR = 'MYR' as CurrencyCode;
const KL = createCalendar('Asia/Kuala_Lumpur');
const now = new Date('2026-10-03T14:06:00+08:00');

function txn(
  date: Date,
  type: FinanceTransaction['type'],
  amountMinor: number,
  over: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  return {
    id: `${date.toISOString()}-${amountMinor}`,
    userId: 'kai',
    receiptImageUrl: null,
    metadata: {},
    updatedAt: '2026-10-01T00:00:00.000Z',
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
    placeId: null,
    placeCoordsAt: null,
    autoAdded: false,
    balanceCorrection: false,
    createdAt: date.toISOString(),
    ...over,
  };
}

describe('categoryMonths', () => {
  it('runs a total per category through today, leaving other currencies and months out', () => {
    expect(
      categoryMonths(
        [
          txn(new Date('2026-10-01T12:00:00+08:00'), 'expense', 1250, { categoryId: 'food' }),
          txn(new Date('2026-10-03T09:00:00+08:00'), 'expense', 4590, { categoryId: 'food' }),
          txn(new Date('2026-10-02T09:00:00+08:00'), 'expense', 3040, { categoryId: 'transport' }),
          txn(new Date('2026-10-02T09:00:00+08:00'), 'expense', 999, {
            categoryId: 'food',
            currency: 'USD' as CurrencyCode,
          }),
          txn(new Date('2026-09-30T09:00:00+08:00'), 'expense', 777, { categoryId: 'food' }),
          txn(new Date('2026-10-01T09:00:00+08:00'), 'income', 420000, { categoryId: 'salary' }),
        ],
        MYR,
        now,
        KL,
      ),
    ).toEqual({
      food: [1250, 1250, 5840],
      transport: [0, 3040, 3040],
      salary: [420000, 420000, 420000],
    });
  });
});
