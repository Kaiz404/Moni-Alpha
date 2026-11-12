import { dateAt, rangeStartIndex, type ChartRange } from '@/lib/finance/chart-range';
import { chartTicks } from '@/lib/finance/chart-ticks';
import { formatMoney } from '@/lib/finance/format-money';
import { spendBuckets, type SpendBuckets, type SpendIndex } from '@/lib/finance/spend-history';

import { MONTHS, niceCeil, type PaceChartMode } from './pace-geometry';
import { scrubPoints, type ScrubPoints } from './scrub';
import type { AxisRow, TickMark } from './zoom-axes';

export const SPEND_TOP = 44;
export const LINE_BASE = 142;
export const BAR_BASE = 141.2;
/** Just over budget, the top label and the budget label would print on each other. */
const AXIS_LABEL_HEIGHT = 16;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The calendar month Home's 1M shows, with its budget. */
export type SpendMonth = {
  name: string;
  daysInMonth: number;
  /** Minor units for the month. */
  budget: number | null;
  /** Daily: today's dashed segment, in minor units. */
  safePerDay: number | null;
};

/**
 * Everything one range and mode shows, in data space: days from the index's first day across,
 * minor units up. Pace points sit at the end of their day (u = day + 1), bars span their days.
 */
export type SpendTarget = {
  mode: PaceChartMode;
  oneMonth: boolean;
  from: number;
  to: number;
  high: number;
  /** Spent before the range starts; the line reads what was spent since. */
  shift: number;
  /** Today, which Pace's callout reads as "By today". */
  lastDay: number;
  /** Daily: the bars, of which `buckets.first` to the last are in the range. */
  buckets: SpendBuckets;
  /** Where a scrub lands: Pace reads a day, Daily a bucket. */
  points: ScrubPoints;
  rows: AxisRow[];
  ticks: TickMark[];
  todayU: number;
  accessibilityLabel: string;
};

/** 1M's budget marks, in data space, kept for every range so they can fade out as the chart zooms away. */
export type MonthMarks = {
  from: number;
  to: number;
  /** Spent before the month started. */
  shift: number;
  budget: number | null;
  /** Daily: the budget spread evenly over the month. */
  evenPace: number | null;
  safePerDay: number | null;
};

export type SpendReading = { date: string; value: string; accessibilityLabel: string };

/** Whole money, rounded down, for axis labels and forward-looking numbers. */
export function whole(minor: number, currency: string): string {
  return formatMoney(Math.floor(minor / 100) * 100, currency, { whole: true });
}

/** "Thu 1 Oct". */
function weekdayDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "1 Oct", or "1 Oct 2025". */
function shortDate(date: Date, withYear = false): string {
  const label = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return withYear ? `${label} ${date.getFullYear()}` : label;
}

function bucketName(index: SpendIndex, buckets: SpendBuckets, bucket: number): string {
  const from = dateAt(index.firstDay, buckets.starts[bucket]!);
  const to = dateAt(index.firstDay, buckets.ends[bucket]!);
  switch (buckets.unit) {
    case 'day':
      return weekdayDate(from);
    case 'week':
      return from.getTime() === to.getTime() ? shortDate(from) : `${shortDate(from)} to ${shortDate(to)}`;
    case 'month':
      return `${MONTHS[from.getMonth()]} ${from.getFullYear()}`;
    case 'year':
      return String(from.getFullYear());
  }
}

/** The first day of a range in the index; All starts at the first spend. */
export function spendRangeFrom(index: SpendIndex, now: Date, range: ChartRange): number {
  return Math.max(0, rangeStartIndex(index.firstDay, now, range) ?? index.firstSpend);
}

export function monthMarks(index: SpendIndex, now: Date, month: SpendMonth): MonthMarks {
  const from = spendRangeFrom(index, now, '1m');
  return {
    from,
    to: from + month.daysInMonth,
    shift: index.cumulative[from]!,
    budget: month.budget,
    evenPace: month.budget === null ? null : month.budget / month.daysInMonth,
    safePerDay: month.safePerDay !== null && month.safePerDay > 0 ? month.safePerDay : null,
  };
}

/** Pace: the range start, each day with spending, and today, each at its day's end. */
export function paceScrubPoints(spent: Float64Array, from: number, today: number): ScrubPoints {
  const pairs: [number, number][] = [];
  for (let day = from; day <= today; day++)
    if (day === from || day === today || spent[day] !== 0) pairs.push([day + 1, day]);
  return scrubPoints(pairs);
}

/** Daily: each bar in the range with spending, and today's, at the bar's centre. */
export function barScrubPoints({ starts, ends, values, first }: SpendBuckets): ScrubPoints {
  const last = values.length - 1;
  const pairs: [number, number][] = [];
  for (let bucket = first; bucket <= last; bucket++)
    if (bucket === last || values[bucket] !== 0)
      pairs.push([(starts[bucket]! + ends[bucket]! + 1) / 2, bucket]);
  return scrubPoints(pairs);
}

/** Zero at the base, under the rows above it; drops a label that would repeat zero's, as RM0 does when nothing was spent. */
function rows(above: AxisRow[], currency: string): AxisRow[] {
  const zero = whole(0, currency);
  return [
    ...above.map((row) => (row.text === zero ? { ...row, text: null } : row)),
    { value: 0, text: zero, line: 'solid' },
  ];
}

export function spendTarget({
  index,
  now,
  range,
  mode,
  month,
  currency,
}: {
  index: SpendIndex;
  now: Date;
  range: ChartRange;
  mode: PaceChartMode;
  month: SpendMonth;
  currency: string;
}): SpendTarget {
  const money = (minor: number) => formatMoney(minor, currency);
  const today = index.days - 1;
  const from = spendRangeFrom(index, now, range);
  const shift = index.cumulative[from]!;
  const spent = index.cumulative[today + 1]! - shift;
  const oneMonth = range === '1m';
  const buckets = spendBuckets(index, from);
  const marks = monthMarks(index, now, month);
  const daily = mode === 'daily';
  const to = oneMonth && !daily ? marks.to : today + 1;
  const tickOffset = daily ? 0.5 : 0;
  const ticks = chartTicks({ range, firstDay: index.firstDay, first: from, last: to - 1 }).map(
    (tick) => ({ u: tick.day + tickOffset, label: tick.label }),
  );
  const shared = {
    mode,
    oneMonth,
    from,
    to,
    shift,
    lastDay: today,
    buckets,
    points: daily ? barScrubPoints(buckets) : paceScrubPoints(index.spent, from, today),
    ticks,
    todayU: today + (daily ? 0.5 : 1),
  };

  if (daily) {
    let highest = 1;
    for (let bucket = buckets.first; bucket < buckets.values.length; bucket++)
      highest = Math.max(highest, buckets.values[bucket]!);
    if (oneMonth) highest = Math.max(highest, marks.evenPace ?? 0, marks.safePerDay ?? 0);
    const high = niceCeil(highest);
    const count = buckets.values.length - buckets.first;
    let over = 0;
    if (marks.evenPace !== null)
      for (let day = from; day <= today; day++) if (index.spent[day]! > marks.evenPace) over++;
    const span = `from ${shortDate(dateAt(index.firstDay, from), true)} to today`;
    return {
      ...shared,
      high,
      rows: rows([{ value: high, text: whole(high, currency), line: 'dashed' }], currency),
      accessibilityLabel: oneMonth
        ? `Daily spending, 1 to ${count} ${month.name}.` +
          (marks.evenPace === null
            ? ''
            : ` ${count - over} of ${count} days stayed at or under the even pace of ${whole(marks.evenPace, currency)}.`)
        : `Spending per ${buckets.unit}, ${span}, ${money(spent)} in all.`,
    };
  }

  const budget = oneMonth ? month.budget : null;
  // Under budget, the budget is the top line, as the boards draw it: niceCeil alone turns RM1,224 into RM2,000.
  const high =
    budget !== null && spent <= budget ? budget : Math.max(budget ?? 0, niceCeil(spent), 1);
  const budgetY =
    budget === null ? null : LINE_BASE - (budget / high) * (LINE_BASE - SPEND_TOP);
  // At budget the top line is the budget's own, so the middle carries the label.
  const atBudget = budget !== null && budget >= high;
  const crowded = budgetY !== null && budgetY - SPEND_TOP < AXIS_LABEL_HEIGHT;
  const above: AxisRow[] = [
    { value: high, text: atBudget || crowded ? null : whole(high, currency), line: 'solid' },
    { value: high / 2, text: atBudget ? whole(budget / 2, currency) : null, line: 'dashed' },
  ];
  return {
    ...shared,
    high,
    rows: rows(above, currency),
    accessibilityLabel: oneMonth
      ? `Spent so far in ${month.name}, ${money(spent)}` +
        (budget === null
          ? '.'
          : `, against the ${whole(budget, currency)} budget. Dashed line is an even pace.`)
      : `Spent from ${shortDate(dateAt(index.firstDay, from), true)} to today, ${money(spent)}.`,
  };
}

/** The callout and screen-reader value for a scrub point's id: a day on Pace, a bucket on Daily. */
export function spendReading(
  index: SpendIndex,
  target: SpendTarget,
  id: number,
  currency: string,
): SpendReading {
  const money = (minor: number) => formatMoney(minor, currency);
  if (target.mode === 'daily') {
    const name = bucketName(index, target.buckets, id);
    const value = money(target.buckets.values[id]!);
    return { date: name, value, accessibilityLabel: `${name}, ${value} spent` };
  }
  const date = dateAt(index.firstDay, id);
  const value = money(index.cumulative[id + 1]! - target.shift);
  const named = target.oneMonth ? weekdayDate(date) : shortDate(date);
  return {
    date: id === target.lastDay ? 'By today' : `By ${named}`,
    value,
    accessibilityLabel: `${target.oneMonth ? named : shortDate(date, true)}, ${value} spent so far`,
  };
}
