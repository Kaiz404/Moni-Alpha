import {
  addDays,
  dateLabel,
  daysAtOrUnderPace,
  daysInMonth,
  evenPace as evenPaceOf,
  firstDayOf,
  formatMoney,
  type MonthKey,
  monthName,
  monthShort,
} from '@repo/core';

export type PaceChartMode = 'pace' | 'daily';

/**
 * Spend per day of `month` so far, in minor units: index 0 is day 1 and the
 * last entry is today. `pace` adds them up.
 */
export type DaySeries = { month: MonthKey; values: readonly number[] };

export type AxisLabel = { y: number; text: string; tone: 'meta' | 'ink' | 'mint' };

export type ChartPoint = {
  x: number;
  y: number;
  /** Callout lines. */
  date: string;
  value: string;
  accessibilityLabel: string;
};

export type ChartBar = {
  x: number;
  top: number;
  /** Top of the even-pace line when the bar rises above it, else null. */
  overTop: number | null;
};

export type PaceGeometry = {
  mode: PaceChartMode;
  width: number;
  top: number;
  baseline: number;
  labels: AxisLabel[];
  points: ChartPoint[];
  /** Pace: the line through `points`, from the baseline at day 0. */
  line: { x: number; y: number }[];
  /** Pace: the even-pace line ends at the budget at month end. */
  evenPace: { x1: number; y1: number; x2: number; y2: number } | null;
  /** Pace: the budget gridline and its end dot. Daily: the even-pace line. */
  budgetY: number | null;
  bars: ChartBar[];
  /** Bars thin out once there are too many for the full width. */
  barWidth: number;
  /** Daily: dashed segment for safe to spend a day, on top of today's bar. */
  safe: { x: number; top: number; height: number } | null;
  ticks: { x: number; text: string; today: boolean }[];
  accessibilityLabel: string;
};

export const PLOT_HEIGHT = 150;
export const AXIS_WIDTH = 44;
/** RM1,800 is wider than the axis. The board lets it overflow left into the card's padding, and numberOfLines would cut it. */
export const AXIS_LABEL_OVERHANG = 16;
const AXIS_LABEL_HEIGHT = 16;
export const BAR_WIDTH = 12;
const TOP = 44;
const LINE_BASE = 142;
const BAR_BASE = 141.2;
const LINE_LEFT = 54;
const LINE_RIGHT_INSET = 4;
const BAR_LEFT = 50;
const BAR_TAIL = 24;
const MAX_SLOT = 24;

/** "Thu 1 Oct". */
function dayDate(month: MonthKey, day: number): string {
  const first = firstDayOf(month);
  return dateLabel(addDays(first, day - 1), first);
}


/** The smallest of 1, 2, 2.5, 5 × 10^k at or above `value`. */
export function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value)!;
  return step * power;
}

function fitBar(slot: number): number {
  return Math.max(3, Math.min(BAR_WIDTH, slot - 2));
}

function cumulative(values: readonly number[]): number[] {
  let total = 0;
  return values.map((value) => (total += value));
}

/**
 * Pure layout for the spent-vs-budget line and daily bars on
 * a `width` × 150 plot whose first 44 are the axis column (tokens.md Charts).
 */
export function paceGeometry({
  mode,
  series,
  budget,
  currency,
  safePerDay = null,
  width,
  endsToday = true,
  what,
}: {
  mode: PaceChartMode;
  series: DaySeries;
  budget: number | null;
  currency: string;
  safePerDay?: number | null;
  width: number;
  /** False for a past month: the last value is its last day, not today. */
  endsToday?: boolean;
  /** Leads the screen-reader sentence, e.g. "Transport spending so far in October". */
  what?: string;
}): PaceGeometry {
  const { month } = series;
  const days = daysInMonth(month);
  const today = series.values.length;
  const name = monthName(month);
  const short = monthShort(month);
  const lastTick = { text: `${days} ${short}`, today: false };
  const money = (minor: number) => formatMoney(minor, currency);

  if (mode === 'daily') {
    const right = width;
    const slot = Math.min(MAX_SLOT, (right - BAR_LEFT - BAR_TAIL) / Math.max(today, 1));
    const evenPace = budget === null ? null : evenPaceOf(budget, month);
    const highest = Math.max(...series.values, evenPace ?? 0, safePerDay ?? 0, 1);
    const max = niceCeil(highest);
    const yOf = (minor: number) => BAR_BASE - (minor / max) * (BAR_BASE - TOP);
    const evenY = evenPace === null ? null : yOf(evenPace);
    const centre = (index: number) => BAR_LEFT + slot * index + slot / 2;
    const bars = series.values.map((value, index) => {
      const top = Math.min(yOf(value), BAR_BASE - 4);
      return {
        x: centre(index),
        top,
        overTop: evenY !== null && top < evenY ? top : null,
      };
    });
    const last = bars[today - 1];
    const safe =
      last && safePerDay !== null && safePerDay > 0
        ? (() => {
            const height = Math.max(BAR_BASE - yOf(safePerDay), 6);
            return { x: last.x, top: last.top - 2 - height, height };
          })()
        : null;
    return {
      mode,
      width,
      top: TOP,
      baseline: BAR_BASE,
      labels: [
        { y: TOP, text: formatMoney(max, currency, { whole: true }), tone: 'meta' },
        ...(evenY === null
          ? []
          : [{ y: evenY, text: formatMoney(evenPace!, currency, { whole: true }), tone: 'ink' as const }]),
        { y: BAR_BASE, text: formatMoney(0, currency, { whole: true }), tone: 'meta' },
      ],
      points: series.values.map((value, index) => ({
        x: centre(index),
        y: bars[index]!.top,
        date: dayDate(month, index + 1),
        value: money(value),
        accessibilityLabel: `${dayDate(month, index + 1)}, ${money(value)} spent`,
      })),
      line: [],
      evenPace: null,
      budgetY: evenY,
      bars,
      barWidth: fitBar(slot),
      safe,
      ticks: today
        ? [
            { x: centre(0), text: `1 ${short}`, today: today === 1 },
            ...(today > 1
              ? [{ x: centre(today - 1), text: endsToday ? 'Today' : `${today} ${short}`, today: endsToday }]
              : []),
          ]
        : [],
      accessibilityLabel:
        `Daily spending, 1 to ${today} ${name}.` +
        (evenPace === null
          ? ''
          : ` ${daysAtOrUnderPace(series.values, evenPace)} of ${today} days stayed at or under the even pace of ${formatMoney(evenPace, currency, { whole: true })}.`),
    };
  }

  const right = width - LINE_RIGHT_INSET;
  const step = (right - LINE_LEFT) / days;
  const xOf = (day: number) => LINE_LEFT + day * step;
  const values = cumulative(series.values);
  const ticks = [
    { x: LINE_LEFT, text: `1 ${short}`, today: false },
    ...(today && endsToday ? [{ x: xOf(today), text: 'Today', today: true }] : []),
    { x: right, ...lastTick },
  ];

  const spent = values[today - 1] ?? 0;
  // Under budget, the budget is the top line, as the boards draw it: niceCeil alone turns RM1,224 into RM2,000.
  const highest = Math.max(...values, 0);
  const max = budget !== null && highest <= budget ? budget : Math.max(budget ?? 0, niceCeil(highest), 1);
  const yOf = (minor: number) => LINE_BASE - (minor / max) * (LINE_BASE - TOP);
  const budgetY = budget === null ? null : yOf(budget);
  const points = values.map((value, index) => ({
    x: xOf(index + 1),
    y: yOf(value),
    date: endsToday && index === today - 1 ? 'By today' : `By ${dayDate(month, index + 1)}`,
    value: money(value),
    accessibilityLabel: `${dayDate(month, index + 1)}, ${money(value)} spent so far`,
  }));
  const labels: AxisLabel[] =
    budget !== null && budget >= max
      ? [
          { y: TOP, text: formatMoney(budget, currency, { whole: true }), tone: 'mint' },
          { y: (TOP + LINE_BASE) / 2, text: formatMoney(budget / 2, currency, { whole: true }), tone: 'meta' },
        ]
      : [
          // Just over budget, the two labels would print on each other.
          ...(budgetY !== null && budgetY - TOP < AXIS_LABEL_HEIGHT
            ? []
            : [{ y: TOP, text: formatMoney(max, currency, { whole: true }), tone: 'meta' as const }]),
          ...(budgetY === null ? [] : [{ y: budgetY, text: formatMoney(budget!, currency, { whole: true }), tone: 'mint' as const }]),
        ];
  return {
    mode,
    width,
    top: TOP,
    baseline: LINE_BASE,
    labels: [...labels, { y: LINE_BASE, text: formatMoney(0, currency, { whole: true }), tone: 'meta' as const }].filter(
      (label, index, all) => index === all.length - 1 || label.text !== all[all.length - 1]!.text,
    ),
    points,
    line: [{ x: LINE_LEFT, y: LINE_BASE }, ...points],
    evenPace: budgetY === null ? null : { x1: LINE_LEFT, y1: LINE_BASE, x2: right, y2: budgetY },
    budgetY,
    bars: [],
    barWidth: BAR_WIDTH,
    safe: null,
    ticks,
    accessibilityLabel:
      `${what ?? `Spent so far in ${name}`}, ${money(spent)}` +
      (budget === null
        ? '.'
        : `, against the ${formatMoney(budget, currency, { whole: true })} budget. Dashed line is an even pace.`),
  };
}

/** Callout left edge: centred on `x`, kept inside the plot right of the axis. */
export function calloutLeft(x: number, width: number): number {
  'worklet';
  return Math.max(AXIS_WIDTH + 4, Math.min(width - 100, x - 50));
}

export function polylineLength(points: readonly { x: number; y: number }[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    length += Math.hypot(points[index]!.x - points[index - 1]!.x, points[index]!.y - points[index - 1]!.y);
  }
  return length;
}
