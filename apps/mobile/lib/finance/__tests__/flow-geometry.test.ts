import type { CurrencyCode, MinorAmount } from '@repo/types';

import { flowSeries, type FinanceTransaction } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';
import { flowGeometry } from '../flow-geometry';

const MYR = 'MYR' as CurrencyCode;
const now = new Date('2026-10-14T12:00:00+08:00');

function row(
  id: string,
  date: Date,
  amountMinor: number,
  over: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  return {
    id,
    userId: 'kai',
    walletId: 'maybank',
    amountMinor: amountMinor as MinorAmount,
    currency: MYR,
    type: 'expense',
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

const series = (
  transactions: FinanceTransaction[],
  range: { from: string; to: string } | null,
) => flowSeries({ transactions, range, now, currency: MYR, calendar: deviceCalendar });
describe('flowGeometry', () => {
  const buckets = (count: number) =>
    series([], { from: '2026-10-01', to: `2026-10-${String(count).padStart(2, '0')}` }).buckets;

  it('draws each pair on one zero-based axis, tallest filling the plot', () => {
    const result = flowSeries({
      transactions: [
        row('in', new Date('2026-10-01T09:00:00+08:00'), 100000, { type: 'income' }),
        row('out', new Date('2026-10-02T09:00:00+08:00'), 50000),
      ],
      range: { from: '2026-10-01', to: '2026-10-02' },
      now,
      currency: MYR,
      calendar: deviceCalendar,
    });
    const geometry = flowGeometry(result.buckets, 318, 'MYR');
    expect(geometry.slots[0].inHeight).toBe(86);
    expect(geometry.slots[1].spentHeight).toBe(43);
    expect(geometry.slots[0].spentHeight).toBe(0);
    expect(geometry.topLabel).toBe('RM1,000');
    expect(geometry.zeroLabel).toBe('RM0');
  });

  it('keeps full bars and every label while there is room', () => {
    const geometry = flowGeometry(buckets(6), 318, 'MYR');
    expect(geometry.bar).toBe(12);
    expect(geometry.slots.every((slot) => slot.label !== null)).toBe(true);
  });

  it('narrows bars and drops labels that would collide at 24 months', () => {
    const months = series([], { from: '2024-11-01', to: '2026-10-31' }).buckets;
    const geometry = flowGeometry(months, 318, 'MYR');
    expect(geometry.slot).toBeCloseTo(11.42, 2);
    expect(geometry.bar).toBeCloseTo(2.71, 2);
    expect(geometry.slots.filter((slot) => slot.label !== null)).toHaveLength(8);
  });
});
