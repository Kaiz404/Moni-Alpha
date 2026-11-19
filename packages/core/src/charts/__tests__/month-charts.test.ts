import { describe, expect, it } from 'vitest';

import { dailyChart, nearestDay, niceCeil, paceChart, runningChart } from '../month-charts';

// A 31-day month, 0 to 310 px wide: the plot runs from x 6 to 304 once the 0-wide axis and the sides go.
const box = { width: 310, height: 108, axis: 0, top: 8, bottom: 8 };
const ten = (n: number) => Array.from({ length: n }, () => 1000);

describe('niceCeil', () => {
  it('rounds up to 1, 2, 2.5 or 5 of a power of ten', () => {
    expect([0, 7, 1800, 2001, 23000, 61000].map(niceCeil)).toEqual([0, 10, 2000, 2500, 25000, 100000]);
  });
});

describe('paceChart', () => {
  const chart = paceChart({
    month: '2026-10',
    daily: [...ten(14), ...Array(17).fill(0)],
    throughDay: 14,
    budget: 31000,
    currency: 'MYR',
    box,
  });

  it('puts the budget on the top gridline in Deep mint, half of it in the middle and RM0 at the base', () => {
    expect(chart.labels).toEqual([
      { y: 8, text: 'RM310', tone: 'mint' },
      { y: 54, text: 'RM155', tone: 'meta' },
      { y: 100, text: 'RM0', tone: 'meta' },
    ]);
    expect(chart.budget).toEqual({ x: 304, y: 8 });
  });

  it('runs the line from 0 before day 1 to today, and the even pace from 0 to the budget at month end', () => {
    expect(chart.line).toHaveLength(15);
    expect(chart.line[0]).toEqual({ x: 6, y: 100 });
    expect(chart.line[14]!.y).toBeCloseTo(100 - (92 * 14000) / 31000);
    expect(chart.evenPace).toEqual({ x1: 6, y1: 100, x2: 304, y2: 8 });
  });

  it('labels 1 Oct, 8, 22 and 29 with Today in bold and hides 15 beside it', () => {
    expect(chart.ticks.map((tick) => [tick.text, tick.today])).toEqual([
      ['1 Oct', false],
      ['8', false],
      ['Today', true],
      ['22', false],
      ['29', false],
    ]);
  });

  it('reads every day so far with its date and the total by then', () => {
    expect(chart.days).toHaveLength(14);
    expect(chart.days[10]).toMatchObject({ day: 11, date: 'Sun 11 Oct', value: 'RM110.00' });
    expect(nearestDay(chart.days, chart.days[10]!.x + 2)?.day).toBe(11);
  });

  it('lifts the top to a nice number over the budget and keeps the budget line below it', () => {
    const over = paceChart({ month: '2026-10', daily: [40000], throughDay: 1, budget: 31000, currency: 'MYR', box });
    expect(over.labels.map((label) => [label.text, label.tone])).toEqual([
      ['RM500', 'meta'],
      ['RM310', 'mint'],
      ['RM250', 'meta'],
      ['RM0', 'meta'],
    ]);
  });
});

describe('dailyChart', () => {
  const chart = dailyChart({
    month: '2026-10',
    daily: [500, 2500, 1000],
    throughDay: 3,
    evenPace: 1000,
    safePerDay: 800,
    isCurrent: true,
    currency: 'MYR',
    box,
  });

  it('draws one bar a day so far, Coral above even pace on the day over it', () => {
    expect(chart.bars).toHaveLength(3);
    expect(chart.bars.map((bar) => bar.overTop !== null)).toEqual([false, true, false]);
    expect(chart.labels.map((label) => label.text)).toEqual(['RM25', 'RM10', 'RM0']);
  });

  it('bands today and stacks safe to spend a day on its bar', () => {
    expect(chart.today?.x).toBeCloseTo(6 + (298 / 31) * 2);
    expect(chart.safe?.height).toBeCloseTo((92 * 800) / 2500);
    expect(chart.days[1]).toMatchObject({ date: 'Fri 2 Oct', value: 'RM25.00' });
  });
});

describe('runningChart', () => {
  const chart = runningChart({
    month: '2026-10',
    daily: [...ten(14), ...Array(17).fill(0)],
    throughDay: 14,
    previousMonth: '2026-09',
    previousDaily: Array(30).fill(600),
    budget: 18000,
    currency: 'MYR',
    box,
  });

  it('rises in four nice steps over the highest of both months and the budget', () => {
    expect(chart.labels.map((label) => label.text)).toEqual(['RM0', 'RM50', 'RM100', 'RM150', 'RM200']);
    expect(chart.budget?.text).toBe('Budget RM180');
  });

  it('ends last month dashed with its total, and keeps both months for each day so far', () => {
    expect(chart.previous).toHaveLength(30);
    expect(chart.previousEnd).toMatchObject({ month: 'Sep', value: 'RM180.00' });
    expect(chart.days[13]).toMatchObject({ day: 14, date: 'Wed 14 Oct', value: 'RM140.00' });
    expect(chart.days[13]!.previousY).toBeCloseTo(100 - (92 * 8400) / 20000);
  });

  it('ends the axis on the month’s last day', () => {
    expect(chart.ticks.map((tick) => tick.text)).toEqual(['1 Oct', '8', 'Today', '22', '31']);
  });
});
