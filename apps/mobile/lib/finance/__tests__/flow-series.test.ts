import type { CurrencyCode, MinorAmount } from '@repo/types';

import { flowGeometry } from '@/lib/finance/flow-geometry';
import { flowSeries } from '@/lib/finance/flow-series';
import type { FinanceTransaction } from '@/lib/finance/types';

const MYR = 'MYR' as CurrencyCode;
const now = new Date(2026, 9, 14, 12);

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
    autoAdded: false,
    balanceCorrection: false,
    createdAt: date.toISOString(),
    ...over,
  };
}

const series = (
  transactions: FinanceTransaction[],
  range: { from: string; to: string } | null,
) => flowSeries({ transactions, range, now, currency: MYR });
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
  it('draws the last six calendar months and says so', () => {
    const result = series([], null);
    expect(result.label).toBe('Last 6 months');
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

  it('leaves older rows out of the chart', () => {
    const result = series(
      [row('old', new Date(2026, 3, 30, 23), 5000), row('kept', new Date(2026, 4, 1, 0), 700)],
      null,
    );
    expect(result.spentMinor).toBe(700);
    expect(result.buckets[0].spentMinor).toBe(700);
  });
});

describe('flowSeries counts as Budget does', () => {
  const rows = [
    row('lunch', new Date(2026, 9, 14, 13), 1890),
    row('salary', new Date(2026, 9, 2, 9), 420000, { type: 'income' }),
    row('reload', new Date(2026, 9, 3), 10000, { type: 'transfer', transferToWalletId: 'tng' }),
    row('excluded', new Date(2026, 9, 3), 300, { analysisExcluded: true }),
    row('debt', new Date(2026, 9, 4), 5000, { debtActivityId: 'd1' }),
    row('debt-in', new Date(2026, 9, 4), 7000, { type: 'income', debtActivityId: 'd2' }),
    row('usd', new Date(2026, 9, 4), 9000, { currency: 'USD' as CurrencyCode }),
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
        row('before', new Date(2026, 9, 12, 23, 59), 1),
        row('first', new Date(2026, 9, 13, 0, 0), 10),
        row('last', new Date(2026, 9, 14, 23, 59), 100),
        row('after', new Date(2026, 9, 15, 0, 0), 1000),
      ],
      { from: '2026-10-13', to: '2026-10-14' },
    );
    expect(result.buckets.map((bucket) => bucket.spentMinor)).toEqual([10, 100]);
    expect(result.spentMinor).toBe(110);
  });
});

describe('flowGeometry', () => {
  const buckets = (count: number) =>
    series([], { from: '2026-10-01', to: `2026-10-${String(count).padStart(2, '0')}` }).buckets;

  it('draws each pair on one zero-based axis, tallest filling the plot', () => {
    const result = flowSeries({
      transactions: [
        row('in', new Date(2026, 9, 1, 9), 100000, { type: 'income' }),
        row('out', new Date(2026, 9, 2, 9), 50000),
      ],
      range: { from: '2026-10-01', to: '2026-10-02' },
      now,
      currency: MYR,
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
