import type { CurrencyCode, MinorAmount } from '@repo/types';

import { spendHistory } from '@/lib/finance/spend-history';
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

describe('spendHistory', () => {
  it('7D has a bar a day, ending today, and counts what Budget counts', () => {
    const { days, buckets, unit } = spendHistory({
      now,
      range: '7d',
      currency,
      transactions: [
        row('2026-11-02', 500),
        row('2026-11-02', 250),
        row('2026-10-27', 100),
        row('2026-10-26', 999),
        row('2026-11-03', 999),
        row('2026-11-01', 999, { type: 'income' }),
        row('2026-11-01', 999, { analysisExcluded: true }),
        row('2026-11-01', 999, { debtActivityId: 'debt' }),
        row('2026-11-01', 999, { currency: 'USD' as CurrencyCode }),
      ],
    });
    expect(unit).toBe('day');
    expect(days[0]).toEqual({ day: '2026-10-27', spentMinor: 100 });
    expect(days.at(-1)).toEqual({ day: '2026-11-02', spentMinor: 750 });
    expect(buckets).toHaveLength(7);
  });

  it('90D groups into weeks from its first day, and no money goes missing', () => {
    const { buckets, unit } = spendHistory({
      now,
      range: '90d',
      currency,
      transactions: [row('2026-08-05', 100), row('2026-08-11', 200), row('2026-08-12', 400), row('2026-11-02', 800)],
    });
    expect(unit).toBe('week');
    expect(buckets[0]).toEqual({ from: '2026-08-05', to: '2026-08-11', spentMinor: 300 });
    expect(buckets[1]).toEqual({ from: '2026-08-12', to: '2026-08-18', spentMinor: 400 });
    expect(buckets.at(-1)!.to).toBe('2026-11-02');
    expect(buckets.reduce((sum, bucket) => sum + bucket.spentMinor, 0)).toBe(1500);
  });

  it('1Y groups into calendar months, its first and last ones partial', () => {
    const { buckets, unit } = spendHistory({ now, range: '1y', currency, transactions: [] });
    expect(unit).toBe('month');
    expect(buckets[0]).toEqual({ from: '2025-11-02', to: '2025-11-30', spentMinor: 0 });
    expect(buckets.at(-1)).toEqual({ from: '2026-11-01', to: '2026-11-02', spentMinor: 0 });
    expect(buckets).toHaveLength(13);
  });

  it('All starts at the first spend and widens to years over a long history', () => {
    const { days, buckets, unit } = spendHistory({
      now,
      range: 'all',
      currency,
      transactions: [row('2023-06-15', 100), row('2026-01-01', 200)],
    });
    expect(days[0]!.day).toBe('2023-06-15');
    expect(unit).toBe('year');
    expect(buckets.map((bucket) => bucket.spentMinor)).toEqual([100, 0, 0, 200]);
  });

  it('All with nothing spent is just today', () => {
    expect(spendHistory({ now, range: 'all', currency, transactions: [] }).days).toEqual([
      { day: '2026-11-02', spentMinor: 0 },
    ]);
  });
});
