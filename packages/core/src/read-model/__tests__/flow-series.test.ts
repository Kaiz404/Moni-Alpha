import { describe, expect, it } from 'vitest';
import type { CurrencyCode, MinorAmount } from '@repo/types';

import { flowSeries } from '../flow-series';
import type { FinanceTransaction } from '../types';
import { createCalendar } from '../../calendar';

const MYR = 'MYR' as CurrencyCode;
const KL = createCalendar('Asia/Kuala_Lumpur');
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
    receiptImageUrl: null,
    metadata: {},
    updatedAt: '2026-10-01T00:00:00.000Z',
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
) => flowSeries({ transactions, range, now, currency: MYR, calendar: KL });
const shape = (result: ReturnType<typeof series>) =>
  result.buckets.map((bucket) => [bucket.key, bucket.label, bucket.from, bucket.to]);

describe('flowSeries bucket size follows the span', () => {
  it('draws days up to 14 days', () => {
    const result = series([], { from: '2026-10-01', to: '2026-10-14' });
    expect(result.buckets).toHaveLength(14);
    expect(shape(result)[13]).toEqual(['2026-10-14', '14', '2026-10-14', '2026-10-14']);
    expect(result.label).toBe('1 Oct to 14 Oct');
  });

  it('draws weeks from the first day at 15 days, the last week cut at the range end', () => {
    expect(shape(series([], { from: '2026-10-01', to: '2026-10-15' }))).toEqual([
      ['2026-10-01', '1 Oct', '2026-10-01', '2026-10-07'],
      ['2026-10-08', '8 Oct', '2026-10-08', '2026-10-14'],
      ['2026-10-15', '15 Oct', '2026-10-15', '2026-10-15'],
    ]);
  });

  it('draws a whole month as five weeks', () => {
    const result = series([], { from: '2026-10-01', to: '2026-10-31' });
    expect(shape(result).at(-1)).toEqual(['2026-10-29', '29 Oct', '2026-10-29', '2026-10-31']);
    expect(result.buckets).toHaveLength(5);
    expect(result.label).toBe('Oct 2026');
  });

  it('keeps the last 3 months in weeks', () => {
    expect(series([], { from: '2026-07-15', to: '2026-10-14' }).buckets).toHaveLength(14);
  });

  it('draws months past about 14 weeks, cutting the ends at the range', () => {
    const result = series([], { from: '2026-03-15', to: '2026-07-10' });
    expect(shape(result)).toEqual([
      ['2026-03', 'Mar', '2026-03-15', '2026-03-31'],
      ['2026-04', 'Apr', '2026-04-01', '2026-04-30'],
      ['2026-05', 'May', '2026-05-01', '2026-05-31'],
      ['2026-06', 'Jun', '2026-06-01', '2026-06-30'],
      ['2026-07', 'Jul', '2026-07-01', '2026-07-10'],
    ]);
  });

  it('draws months for two years and years past that', () => {
    expect(series([], { from: '2024-11-01', to: '2026-10-31' }).buckets).toHaveLength(24);
    expect(shape(series([], { from: '2023-06-01', to: '2026-02-10' }))).toEqual([
      ['2023', '2023', '2023-06-01', '2023-12-31'],
      ['2024', '2024', '2024-01-01', '2024-12-31'],
      ['2025', '2025', '2025-01-01', '2025-12-31'],
      ['2026', '2026', '2026-01-01', '2026-02-10'],
    ]);
  });

  it('draws a one-day range as one bar pair', () => {
    expect(shape(series([], { from: '2026-10-14', to: '2026-10-14' }))).toEqual([
      ['2026-10-14', '14', '2026-10-14', '2026-10-14'],
    ]);
  });
});

describe('flowSeries with no range', () => {
  it('draws all time as at least the last six calendar months', () => {
    const result = series([row('recent', new Date('2026-09-03T12:00:00+08:00'), 700)], null);
    expect(result.label).toBe('All time');
    expect(result.range).toEqual({ from: '2026-05-01', to: '2026-10-31' });
    expect(result.buckets.map((bucket) => bucket.label)).toEqual([
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
    ]);
  });

  it('reaches back to the month of the first row that counts, so the totals cover every row', () => {
    const result = series(
      [
        row('old', new Date('2025-11-30T23:00:00+08:00'), 5000),
        row('kept', new Date('2026-05-01T00:00:00+08:00'), 700),
        row('older-transfer', new Date('2024-01-05T12:00:00+08:00'), 900, { type: 'transfer' }),
      ],
      null,
    );
    expect(result.range).toEqual({ from: '2025-11-01', to: '2026-10-31' });
    expect(result.spentMinor).toBe(5700);
    expect(result.buckets[0]).toMatchObject({ key: '2025-11', spentMinor: 5000 });
  });
});

describe('flowSeries counts as Budget does', () => {
  const rows = [
    row('lunch', new Date('2026-10-14T13:00:00+08:00'), 1890),
    row('salary', new Date('2026-10-02T09:00:00+08:00'), 420000, { type: 'income' }),
    row('reload', new Date('2026-10-03T00:00:00+08:00'), 10000, { type: 'transfer', transferToWalletId: 'tng' }),
    row('excluded', new Date('2026-10-03T00:00:00+08:00'), 300, { analysisExcluded: true }),
    row('debt', new Date('2026-10-04T00:00:00+08:00'), 5000, { debtActivityId: 'd1' }),
    row('debt-in', new Date('2026-10-04T00:00:00+08:00'), 7000, { type: 'income', debtActivityId: 'd2' }),
    row('usd', new Date('2026-10-04T00:00:00+08:00'), 9000, { currency: 'USD' as CurrencyCode }),
  ];

  it('totals spending and money in, leaving out transfers, exclusions, debt cash and other currencies', () => {
    const result = series(rows, { from: '2026-10-01', to: '2026-10-31' });
    expect(result.spentMinor).toBe(1890);
    expect(result.inMinor).toBe(420000);
  });

  it('files each row in its own bucket, and the buckets add up to the totals', () => {
    const result = series(rows, { from: '2026-10-01', to: '2026-10-31' });
    expect(result.buckets.map((bucket) => [bucket.spentMinor, bucket.inMinor])).toEqual([
      [0, 420000],
      [1890, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
  });

  it('keeps both end days whole', () => {
    const result = series(
      [
        row('before', new Date('2026-10-12T23:59:00+08:00'), 1),
        row('first', new Date('2026-10-13T00:00:00+08:00'), 10),
        row('last', new Date('2026-10-14T23:59:00+08:00'), 100),
        row('after', new Date('2026-10-15T00:00:00+08:00'), 1000),
      ],
      { from: '2026-10-13', to: '2026-10-14' },
    );
    expect(result.buckets.map((bucket) => bucket.spentMinor)).toEqual([10, 100]);
    expect(result.spentMinor).toBe(110);
  });
});
