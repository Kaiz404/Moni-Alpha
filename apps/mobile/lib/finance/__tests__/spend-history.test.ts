import type { CurrencyCode, MinorAmount } from '@repo/types';

import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { dateAt, rangeStartIndex } from '@/lib/finance/chart-range';
import { spendBuckets, spendIndex, type SpendIndex } from '@/lib/finance/spend-history';
import type { FinanceTransaction } from '@/lib/finance/types';

const now = new Date(2026, 10, 2, 12);
const currency = 'MYR' as CurrencyCode;

function row(day: string, amount: number, extra: Partial<FinanceTransaction> = {}): FinanceTransaction {
  return {
    id: `${day}-${amount}`,
    type: 'expense',
    currency,
    amountMinor: amount as MinorAmount,
    transactionDate: new Date(`${day}T12:00:00`).toISOString(),
    analysisExcluded: false,
    debtActivityId: null,
    ...extra,
  } as FinanceTransaction;
}

/** The bars a range draws, as dates, with what each holds. */
function bars(index: SpendIndex, range: '7d' | '90d' | '1y' | 'all') {
  const from = rangeStartIndex(index.firstDay, now, range) ?? index.firstSpend;
  const buckets = spendBuckets(index, from);
  const day = (at: number) => toLocalDateInput(dateAt(index.firstDay, at));
  return {
    unit: buckets.unit,
    bars: Array.from(buckets.values.subarray(buckets.first), (spentMinor, at) => ({
      from: day(buckets.starts[buckets.first + at]!),
      to: day(buckets.ends[buckets.first + at]!),
      spentMinor,
    })),
  };
}

describe('spendIndex', () => {
  it('holds a year of days ending today, adds up each day, and counts what Budget counts', () => {
    const index = spendIndex({
      now,
      currency,
      transactions: [
        row('2026-11-02', 500),
        row('2026-11-02', 250),
        row('2026-10-27', 100),
        row('2026-11-03', 999),
        row('2026-11-01', 999, { type: 'income' }),
        row('2026-11-01', 999, { analysisExcluded: true }),
        row('2026-11-01', 999, { debtActivityId: 'debt' }),
        row('2026-11-01', 999, { currency: 'USD' as CurrencyCode }),
      ],
    });
    expect(index.firstDay).toBe('2025-11-02');
    expect(index.days).toBe(366);
    expect(index.firstSpend).toBe(359);
    expect(Array.from(index.spent.subarray(359))).toEqual([100, 0, 0, 0, 0, 0, 750]);
    expect(index.cumulative).toHaveLength(367);
    expect(index.cumulative[359]).toBe(0);
    expect(index.cumulative[366]).toBe(850);
  });

  it('reaches back to the first spend when it is older than a year', () => {
    const index = spendIndex({ now, currency, transactions: [row('2023-06-15', 100)] });
    expect([index.firstDay, index.firstSpend]).toEqual(['2023-06-15', 0]);
  });

  it('puts the first spend on today when nothing was spent', () => {
    const index = spendIndex({ now, currency, transactions: [] });
    expect([index.days, index.firstSpend, index.cumulative[366]]).toEqual([366, 365, 0]);
  });
});

describe('spendBuckets', () => {
  it('7D has a bar a day, ending today', () => {
    const index = spendIndex({ now, currency, transactions: [row('2026-11-02', 750), row('2026-10-27', 100)] });
    const { unit, bars: days } = bars(index, '7d');
    expect(unit).toBe('day');
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ from: '2026-10-27', to: '2026-10-27', spentMinor: 100 });
    expect(days.at(-1)).toEqual({ from: '2026-11-02', to: '2026-11-02', spentMinor: 750 });
  });

  it('90D groups into weeks from its first day, and no money goes missing', () => {
    const index = spendIndex({
      now,
      currency,
      transactions: [row('2026-08-05', 100), row('2026-08-11', 200), row('2026-08-12', 400), row('2026-11-02', 800)],
    });
    const { unit, bars: weeks } = bars(index, '90d');
    expect(unit).toBe('week');
    expect(weeks[0]).toEqual({ from: '2026-08-05', to: '2026-08-11', spentMinor: 300 });
    expect(weeks[1]).toEqual({ from: '2026-08-12', to: '2026-08-18', spentMinor: 400 });
    expect(weeks.at(-1)!.to).toBe('2026-11-02');
    expect(weeks.reduce((sum, week) => sum + week.spentMinor, 0)).toBe(1500);
  });

  it('1Y groups into calendar months, its first and last ones partial', () => {
    const { unit, bars: months } = bars(spendIndex({ now, currency, transactions: [] }), '1y');
    expect(unit).toBe('month');
    expect(months[0]).toEqual({ from: '2025-11-02', to: '2025-11-30', spentMinor: 0 });
    expect(months.at(-1)).toEqual({ from: '2026-11-01', to: '2026-11-02', spentMinor: 0 });
    expect(months).toHaveLength(13);
  });

  it('All starts at the first spend and widens to years over a long history', () => {
    const index = spendIndex({ now, currency, transactions: [row('2023-06-15', 100), row('2026-01-01', 200)] });
    const { unit, bars: years } = bars(index, 'all');
    expect(unit).toBe('year');
    expect(years[0]!.from).toBe('2023-06-15');
    expect(years.map((year) => year.spentMinor)).toEqual([100, 0, 0, 200]);
  });

  it('keys day bars the same in every range, so a zoom between them keeps the bars', () => {
    const index = spendIndex({ now, currency, transactions: [] });
    expect(spendBuckets(index, 359).key).toBe(spendBuckets(index, 336).key);
    expect(spendBuckets(index, 300).key).toBe('week:300');
  });
});
