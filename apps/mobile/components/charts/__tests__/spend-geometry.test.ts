import type { CurrencyCode, MinorAmount } from '@repo/types';

import { spendReading, spendTarget } from '@/components/charts/spend-geometry';
import type { ChartRange } from '@/lib/finance/chart-range';
import { spendIndex } from '@/lib/finance/spend-history';
import type { FinanceTransaction } from '@/lib/finance/types';

const now = new Date(2026, 9, 14, 12);
const currency = 'MYR' as CurrencyCode;
const spend = (month: number, day: number, amount: number) =>
  ({
    id: `${month}-${day}`,
    type: 'expense',
    currency,
    amountMinor: amount as MinorAmount,
    transactionDate: new Date(2026, month - 1, day, 9).toISOString(),
    analysisExcluded: false,
    debtActivityId: null,
  }) as FinanceTransaction;

const index = spendIndex({
  now,
  currency,
  transactions: [spend(10, 14, 1000), spend(10, 10, 2500), spend(9, 20, 4000)],
});
const today = index.days - 1;
const october = { name: 'October', daysInMonth: 31, budget: 180000, safePerDay: 1700 };
const target = (range: ChartRange, mode: 'pace' | 'daily') =>
  spendTarget({ index, now, range, mode, month: october, currency });

describe('spendTarget', () => {
  it('1M Pace spans the whole month, reads from its first day, and tops out at the budget', () => {
    const month = target('1m', 'pace');
    expect([month.from, month.to, month.todayU]).toEqual([today - 13, today + 18, today + 1]);
    expect([month.shift, month.high]).toEqual([4000, 180000]);
    expect(month.rows.map((row) => row.text)).toEqual(['RM900', 'RM0']);
    expect(month.ticks).toEqual([
      { u: today - 13, label: '1 Oct' },
      { u: today - 6, label: '8' },
      { u: today + 1, label: '15' },
      { u: today + 8, label: '22' },
      { u: today + 15, label: '29' },
    ]);
  });

  it('1M Daily ends on today and puts ticks under the middle of each bar', () => {
    const month = target('1m', 'daily');
    expect([month.from, month.to, month.todayU]).toEqual([today - 13, today + 1, today + 0.5]);
    expect(month.high).toBe(10000);
    expect(month.ticks.map((tick) => tick.u)).toEqual([today - 12.5, today - 5.5]);
    expect(month.count).toBe(14);
  });

  it('7D zooms to the last seven days and counts from the first of them', () => {
    const week = target('7d', 'pace');
    expect([week.from, week.to, week.shift, week.high]).toEqual([today - 6, today + 1, 4000, 5000]);
    expect(week.accessibilityLabel).toBe('Spent from 8 Oct 2026 to today, RM35.00.');
    expect(week.ticks.map((tick) => tick.label)).toEqual(['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed']);
  });

  it('All starts on the first spend', () => {
    expect(target('all', 'pace').from).toBe(today - 24);
  });
});

describe('spendReading', () => {
  it('reads the running total since the range start on Pace', () => {
    const month = target('1m', 'pace');
    expect(spendReading(index, month, 13, currency)).toEqual({
      date: 'By today',
      value: 'RM35.00',
      accessibilityLabel: 'Wed 14 Oct, RM35.00 spent so far',
    });
    expect(spendReading(index, month, 12, currency).date).toBe('By Tue 13 Oct');
    expect(spendReading(index, target('30d', 'pace'), 0, currency)).toEqual({
      date: 'By 15 Sep',
      value: 'RM0.00',
      accessibilityLabel: '15 Sep 2026, RM0.00 spent so far',
    });
  });

  it('names the bar on Daily', () => {
    expect(spendReading(index, target('7d', 'daily'), 6, currency).date).toBe('Wed 14 Oct');
    const year = target('1y', 'daily');
    expect(spendReading(index, year, year.count - 1, currency)).toEqual({
      date: 'Oct 2026',
      value: 'RM35.00',
      accessibilityLabel: 'Oct 2026, RM35.00 spent',
    });
  });
});
