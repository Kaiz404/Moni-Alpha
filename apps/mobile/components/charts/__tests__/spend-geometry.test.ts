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

describe('scrub points', () => {
  const points = (range: ChartRange, mode: 'pace' | 'daily') => {
    const { at, ids } = target(range, mode).points;
    return { at: Array.from(at), ids: Array.from(ids) };
  };

  it('Pace lands on the range start, each day with spending, and today, at the end of each day', () => {
    expect(today).toBe(365);
    expect(points('1m', 'pace')).toEqual({ ids: [352, 361, 365], at: [353, 362, 366] });
    expect(points('30d', 'pace')).toEqual({ ids: [336, 341, 361, 365], at: [337, 342, 362, 366] });
    expect(points('7d', 'pace')).toEqual({ ids: [359, 361, 365], at: [360, 362, 366] });
  });

  it('Daily lands on each bar with spending and today, at the bar centre', () => {
    expect(points('1m', 'daily')).toEqual({ ids: [361, 365], at: [361.5, 365.5] });
    expect(points('90d', 'daily')).toEqual({ ids: [9, 12], at: [342.5, 363] });
    expect(points('1y', 'daily')).toEqual({ ids: [11, 12], at: [337, 359] });
  });

  it('counts several spends on one day as one point', () => {
    const busy = spendIndex({
      now,
      currency,
      transactions: [spend(10, 12, 100), spend(10, 12, 200), spend(10, 12, 300)],
    });
    const { ids } = spendTarget({ index: busy, now, range: '7d', mode: 'pace', month: october, currency }).points;
    expect(Array.from(ids)).toEqual([359, 363, 365]);
  });
});

describe('spendReading', () => {
  it('reads the running total since the range start on Pace', () => {
    const month = target('1m', 'pace');
    expect(spendReading(index, month, today, currency)).toEqual({
      date: 'By today',
      value: 'RM35.00',
      accessibilityLabel: 'Wed 14 Oct, RM35.00 spent so far',
    });
    expect(spendReading(index, month, today - 1, currency).date).toBe('By Tue 13 Oct');
    expect(spendReading(index, target('30d', 'pace'), today - 29, currency)).toEqual({
      date: 'By 15 Sep',
      value: 'RM0.00',
      accessibilityLabel: '15 Sep 2026, RM0.00 spent so far',
    });
  });

  it('names the bar on Daily', () => {
    expect(spendReading(index, target('7d', 'daily'), today, currency).date).toBe('Wed 14 Oct');
    expect(spendReading(index, target('1y', 'daily'), 12, currency)).toEqual({
      date: 'Oct 2026',
      value: 'RM35.00',
      accessibilityLabel: 'Oct 2026, RM35.00 spent',
    });
  });
});
