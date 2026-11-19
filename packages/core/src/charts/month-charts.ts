import { addDays, daysInMonth, firstDayOf, type MonthKey } from '../calendar';
import { chartTicks, dateLabel, formatMoney, monthShort } from '../glossary';

/**
 * Layout for the month charts the web draws at any size: Home's Pace and Daily, and Activity's running
 * totals against last month. Coordinates are px inside a `width` × `height` box whose first `axis` px
 * hold the money labels. Values are minor units.
 */
export type ChartBox = { width: number; height: number; axis: number; top: number; bottom: number };

export type ChartLabel = { y: number; text: string; tone: 'meta' | 'ink' | 'mint' };
export type ChartTickMark = { x: number; text: string; today: boolean };
/** One readable day: where the pointer snaps, and what the tooltip says. */
export type ChartDay = { day: number; x: number; y: number; date: string; value: string };
export type Point = { x: number; y: number };

/** Ticks this close to today's hide, as tokens.md Charts says. */
const TODAY_CLEARANCE = 52;
const SIDE = 6;

/** The smallest of 1, 2, 2.5, 5 × 10^k at or above `value`. */
export function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value)!;
  return step * power;
}

function plot(box: ChartBox) {
  return { left: box.axis + SIDE, right: box.width - SIDE, top: box.top, base: box.height - box.bottom };
}

function running(values: readonly number[]): number[] {
  let total = 0;
  return values.map((value) => (total += value));
}

/** 1M's ticks (1 Oct, 8, 15, 22, 29), Today in bold, and none within 52 px of it. */
function monthTicks(month: MonthKey, today: number | null, xOf: (day: number) => number): ChartTickMark[] {
  const days = daysInMonth(month);
  const marks = chartTicks({ range: '1m', firstDay: firstDayOf(month), first: 0, last: days - 1 }).map((tick) => ({
    x: xOf(tick.day + 1),
    text: tick.label,
    today: false,
  }));
  if (today === null) return marks;
  const at = xOf(today);
  return [...marks.filter((mark) => Math.abs(mark.x - at) >= TODAY_CLEARANCE), { x: at, text: 'Today', today: true }].sort(
    (a, b) => a.x - b.x,
  );
}

function dayName(month: MonthKey, day: number): string {
  const first = firstDayOf(month);
  return dateLabel(addDays(first, day - 1), first);
}

export type PaceChart = {
  labels: ChartLabel[];
  grid: { top: number; middle: number; base: number; left: number; right: number };
  /** The budget's end dot and its "Budget" caption; null without a budget. */
  budget: { x: number; y: number } | null;
  line: Point[];
  area: string;
  evenPace: { x1: number; y1: number; x2: number; y2: number } | null;
  ticks: ChartTickMark[];
  days: ChartDay[];
};

/**
 * Spent against budget: the running total from 0 at the month's start to today, the budget as the top
 * gridline when the spend stays under it, and the even pace dashed from 0 to the budget at month end.
 */
export function paceChart({
  month,
  daily,
  throughDay,
  budget,
  currency,
  box,
}: {
  month: MonthKey;
  /** Spend per day of the month, index 0 is day 1. */
  daily: readonly number[];
  /** Today in the running month, the last day otherwise. */
  throughDay: number;
  budget: number | null;
  currency: string;
  box: ChartBox;
}): PaceChart {
  const { left, right, top, base } = plot(box);
  const days = daysInMonth(month);
  const totals = running(daily.slice(0, throughDay));
  const highest = Math.max(0, ...totals);
  const max = budget !== null && highest <= budget ? budget : Math.max(budget ?? 0, niceCeil(highest), 1);
  const xOf = (day: number) => left + ((right - left) * day) / days;
  const yOf = (minor: number) => base - ((base - top) * minor) / max;
  const line = [{ x: xOf(0), y: base }, ...totals.map((value, index) => ({ x: xOf(index + 1), y: yOf(value) }))];
  const last = line.at(-1)!;
  const money = (minor: number) => formatMoney(minor, currency, { whole: true });
  const budgetY = budget === null ? null : yOf(budget);
  return {
    labels: [
      { y: top, text: money(max), tone: budget !== null && budget === max ? 'mint' : 'meta' },
      ...(budget !== null && budget !== max ? [{ y: budgetY!, text: money(budget), tone: 'mint' as const }] : []),
      { y: (top + base) / 2, text: money(max / 2), tone: 'meta' as const },
      { y: base, text: money(0), tone: 'meta' as const },
    ],
    grid: { top, middle: (top + base) / 2, base, left, right },
    budget: budget === null ? null : { x: right, y: budgetY! },
    line,
    area: `M${line.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' L')} L${last.x.toFixed(1)},${base} Z`,
    evenPace: budgetY === null ? null : { x1: left, y1: base, x2: right, y2: budgetY },
    ticks: monthTicks(month, throughDay < days || budget !== null ? throughDay : null, xOf),
    days: totals.map((value, index) => ({
      day: index + 1,
      x: xOf(index + 1),
      y: yOf(value),
      date: dayName(month, index + 1),
      value: formatMoney(value, currency),
    })),
  };
}

export type DailyBar = { x: number; width: number; top: number; overTop: number | null };

export type DailyChart = {
  labels: ChartLabel[];
  grid: { top: number; base: number; left: number; right: number };
  bars: DailyBar[];
  evenPaceY: number | null;
  /** Today's slot, drawn as a Sand light band. */
  today: { x: number; width: number } | null;
  /** Safe to spend a day, dashed on top of today's bar. */
  safe: { x: number; top: number; height: number } | null;
  ticks: ChartTickMark[];
  days: ChartDay[];
};

/** One bar per day so far, the part above even pace in Coral; no future bars. */
export function dailyChart({
  month,
  daily,
  throughDay,
  evenPace,
  safePerDay,
  isCurrent,
  currency,
  box,
}: {
  month: MonthKey;
  daily: readonly number[];
  throughDay: number;
  evenPace: number | null;
  safePerDay: number | null;
  isCurrent: boolean;
  currency: string;
  box: ChartBox;
}): DailyChart {
  const { left, right, top, base } = plot(box);
  const days = daysInMonth(month);
  const values = daily.slice(0, throughDay);
  const step = (right - left) / days;
  const width = Math.max(3, Math.min(16, step * 0.55));
  const max = niceCeil(Math.max(1, ...values, evenPace ?? 0, safePerDay ?? 0));
  const yOf = (minor: number) => base - ((base - top) * minor) / max;
  const centre = (day: number) => left + step * (day - 1) + step / 2;
  const evenY = evenPace === null ? null : yOf(evenPace);
  const bars = values.map((value, index) => {
    const barTop = value > 0 ? Math.min(yOf(value), base - 2) : base;
    return { x: centre(index + 1) - width / 2, width, top: barTop, overTop: evenY !== null && barTop < evenY ? barTop : null };
  });
  const lastBar = isCurrent ? bars[throughDay - 1] : undefined;
  return {
    labels: [
      { y: top, text: formatMoney(max, currency, { whole: true }), tone: 'meta' },
      ...(evenY === null ? [] : [{ y: evenY, text: formatMoney(evenPace!, currency, { whole: true }), tone: 'ink' as const }]),
      { y: base, text: formatMoney(0, currency, { whole: true }), tone: 'meta' },
    ],
    grid: { top, base, left, right },
    bars,
    evenPaceY: evenY,
    today: isCurrent && throughDay > 0 ? { x: left + step * (throughDay - 1), width: step } : null,
    safe:
      lastBar && safePerDay !== null && safePerDay > 0
        ? (() => {
            const height = Math.max(base - yOf(safePerDay), 6);
            return { x: lastBar.x + lastBar.width / 2, top: lastBar.top - 3 - height, height };
          })()
        : null,
    ticks: monthTicks(month, isCurrent ? throughDay : null, centre),
    days: values.map((value, index) => ({
      day: index + 1,
      x: centre(index + 1),
      y: bars[index]!.top,
      date: dayName(month, index + 1),
      value: formatMoney(value, currency),
    })),
  };
}

export type RunningChart = {
  labels: ChartLabel[];
  rows: number[];
  grid: { left: number; right: number; top: number; base: number };
  budget: { y: number; text: string } | null;
  line: Point[];
  area: string;
  previous: Point[];
  /** "Sep RM1,744.30" at the end of last month's line. */
  previousEnd: { x: number; y: number; month: string; value: string } | null;
  ticks: ChartTickMark[];
  /** Per day so far: this month's total, and last month's by the same day for the hollow dot. */
  days: (ChartDay & { previousY: number | null })[];
};

/**
 * Activity's chart: this month's running spend to today against last month's whole running line,
 * dashed, with the budget as a Deep mint line. The y axis rises in four nice steps.
 */
export function runningChart({
  month,
  daily,
  throughDay,
  previousMonth,
  previousDaily,
  budget,
  currency,
  box,
}: {
  month: MonthKey;
  daily: readonly number[];
  throughDay: number;
  previousMonth: MonthKey;
  previousDaily: readonly number[];
  budget: number | null;
  currency: string;
  box: ChartBox;
}): RunningChart {
  const { left, right, top, base } = plot(box);
  const days = daysInMonth(month);
  const totals = running(daily.slice(0, throughDay));
  const before = running(previousDaily);
  const step = niceCeil(Math.max(1, ...totals, ...before, budget ?? 0) / 4);
  const max = step * 4;
  const span = Math.max(days, before.length);
  const xOf = (day: number) => left + ((right - left) * (day - 1)) / Math.max(span - 1, 1);
  const yOf = (minor: number) => base - ((base - top) * minor) / max;
  const line = totals.map((value, index) => ({ x: xOf(index + 1), y: yOf(value) }));
  const previous = before.map((value, index) => ({ x: xOf(index + 1), y: yOf(value) }));
  const rows = [0, 1, 2, 3, 4].map((row) => step * row);
  const lastPoint = line.at(-1);
  return {
    labels: rows.map((value) => ({ y: yOf(value), text: formatMoney(value, currency, { whole: true }), tone: 'meta' })),
    rows: rows.map(yOf),
    grid: { left, right, top, base },
    budget: budget === null ? null : { y: yOf(budget), text: `Budget ${formatMoney(budget, currency, { whole: true })}` },
    line,
    area: lastPoint
      ? `M${line[0]!.x.toFixed(1)},${base} L${line.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' L')} L${lastPoint.x.toFixed(1)},${base} Z`
      : '',
    previous,
    previousEnd:
      before.length > 0
        ? { ...previous.at(-1)!, month: monthShort(previousMonth), value: formatMoney(before.at(-1)!, currency) }
        : null,
    ticks: (() => {
      const marks = monthTicks(month, throughDay, xOf);
      const end = xOf(span);
      if (Math.abs(end - xOf(throughDay)) < TODAY_CLEARANCE) return marks;
      return [...marks.filter((mark) => mark.today || Math.abs(mark.x - end) >= TODAY_CLEARANCE), { x: end, text: String(span), today: false }];
    })(),
    days: totals.map((value, index) => ({
      day: index + 1,
      x: xOf(index + 1),
      y: yOf(value),
      date: dayName(month, index + 1),
      value: formatMoney(value, currency),
      previousY: index < before.length ? yOf(before[index]!) : null,
    })),
  };
}

/** The day nearest `x`, for a pointer over the plot. */
export function nearestDay<T extends { x: number }>(days: readonly T[], x: number): T | null {
  let best: T | null = null;
  for (const day of days) if (!best || Math.abs(day.x - x) < Math.abs(best.x - x)) best = day;
  return best;
}
