import { describe, expect, it } from 'vitest';
import type { CurrencyCode, MinorAmount } from '@repo/types';

import { createCalendar } from '../../calendar';
import type { FinanceTransaction } from '../../read-model/types';
import { lastMonthAndAverage, spendByMonth } from '../spend-by-month';

const KL = createCalendar('Asia/Kuala_Lumpur');
const MYR = 'MYR' as CurrencyCode;

let nextId = 1;
function spend(when: string, minor: number, categoryId: string | null, over: Partial<FinanceTransaction> = {}): FinanceTransaction {
  return {
    id: `t${nextId++}`,
    userId: 'u',
    walletId: 'maybank',
    amountMinor: minor as MinorAmount,
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
    transactionDate: when,
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    placeId: null,
    placeCoordsAt: null,
    autoAdded: false,
    balanceCorrection: false,
    receiptImageUrl: null,
    metadata: {},
    createdAt: when,
    updatedAt: when,
    ...over,
  };
}

const rows = [
  spend('2026-08-05T12:00:00+08:00', 9000, 'transport'),
  spend('2026-09-12T12:00:00+08:00', 6000, 'transport'),
  spend('2026-09-20T12:00:00+08:00', 3000, 'food'),
  // 00:30 on 1 Oct in Kuala Lumpur is still 30 Sep in UTC: it belongs to October.
  spend('2026-09-30T16:30:00.000Z', 14000, 'transport'),
  spend('2026-10-03T12:00:00+08:00', 500, null),
  spend('2026-10-04T12:00:00+08:00', 2000, 'transport', { type: 'income' }),
  spend('2026-10-04T12:00:00+08:00', 4000, 'transport', { analysisExcluded: true }),
  spend('2026-10-05T12:00:00+08:00', 7700, 'transport', { currency: 'SGD' as CurrencyCode }),
];

describe('spendByMonth', () => {
  it('splits spending by category and month in one currency and the user’s zone', () => {
    const history = spendByMonth(rows, { month: '2026-10', count: 4, currency: MYR, calendar: KL });
    expect(history.months).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    expect(history.totals).toEqual([0, 9000, 9000, 14500]);
    expect(Object.fromEntries(history.byCategory)).toEqual({
      transport: [0, 9000, 6000, 14000],
      food: [0, 0, 3000, 0],
      null: [0, 0, 0, 500],
    });
    expect(history.firstMonth).toBe('2026-08');
  });

  it('reads last month and the three months before, leaving out months before the first spend', () => {
    const history = spendByMonth(rows, { month: '2026-10', count: 6, currency: MYR, calendar: KL });
    expect(lastMonthAndAverage(history, history.byCategory.get('transport')!)).toEqual({
      lastMonthMinor: 6000,
      averageMinor: 7500,
    });
    expect(lastMonthAndAverage(history, history.totals)).toEqual({ lastMonthMinor: 9000, averageMinor: 9000 });
  });

  it('has no average before any spending', () => {
    const history = spendByMonth([], { month: '2026-10', count: 6, currency: MYR, calendar: KL });
    expect(lastMonthAndAverage(history, history.totals)).toEqual({ lastMonthMinor: 0, averageMinor: null });
  });
});
