import { formatMoney } from '@/lib/finance/format-money';

export type PaceChartMode = 'pace' | 'daily' | 'balance';

/** A calendar month; `month` is 0 for January. */
export type ChartMonth = { year: number; month: number };

/**
 * One value per day of `month` so far, in minor units: index 0 is day 1 and
 * the last entry is today. Spend per day for `pace` and `daily` (pace adds
 * them up), the closing balance for `balance`.
 */
export type DaySeries = { month: ChartMonth; values: readonly number[] };

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
  /** Pace and balance: the line through `points`, the first one at the baseline for pace. */
  line: { x: number; y: number }[];
  /** Pace: the even-pace line ends at the budget at month end. */
  evenPace: { x1: number; y1: number; x2: number; y2: number } | null;
  /** Pace: the budget gridline and its end dot. Daily: the even-pace line. */
  budgetY: number | null;
  bars: ChartBar[];
  /** Daily: dashed segment for safe to spend a day, on top of today's bar. */
  safe: { x: number; top: number; height: number } | null;
  ticks: { x: number; text: string; today: boolean }[];
  accessibilityLabel: string;
};

export const PLOT_HEIGHT = 150;
export const AXIS_WIDTH = 44;
export const BAR_WIDTH = 12;
const TOP = 44;
const LINE_BASE = 142;
const BAR_BASE = 141.2;
const LINE_LEFT = 54;
const LINE_RIGHT_INSET = 4;
const BAR_LEFT = 50;
const BAR_TAIL = 24;
const MAX_SLOT = 24;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** `YYYY-MM` to a ChartMonth. */
export function monthFromKey(key: string): ChartMonth {
  const [year, month] = key.split('-').map(Number);
  return { year: year!, month: month! - 1 };
}

export function daysInMonth({ year, month }: ChartMonth): number {
  return new Date(year, month + 1, 0).getDate();
}

export function monthName({ month }: ChartMonth): string {
  return MONTH_NAMES[month]!;
}

/** "Thu 1 Oct". */
export function dayDate({ year, month }: ChartMonth, day: number): string {
  const date = new Date(year, month, day);
  return `${WEEKDAYS[date.getDay()]} ${day} ${MONTHS[month]}`;
}

/** Whole money, rounded down, for axis labels and forward-looking numbers. */
function whole(minor: number, currency: string): string {
  return formatMoney(Math.floor(minor / 100) * 100, currency, { whole: true });
}

/** The smallest of 1, 2, 2.5, 5 × 10^k at or above `value`. */
function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value)!;
  return step * power;
}

function cumulative(values: readonly number[]): number[] {
  let total = 0;
  return values.map((value) => (total += value));
}

/**
 * Pure layout for the spent-vs-budget line, daily bars, and balance line on
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
  const short = MONTHS[month.month];
  const lastTick = { text: `${days} ${short}`, today: false };
  const money = (minor: number) => formatMoney(minor, currency);

  if (mode === 'daily') {
    const right = width;
    const slot = Math.min(MAX_SLOT, (right - BAR_LEFT - BAR_TAIL) / Math.max(today, 1));
    const evenPace = budget === null ? null : budget / days;
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
    const over = evenPace === null ? 0 : series.values.filter((v) => v > evenPace).length;
    return {
      mode,
      width,
      top: TOP,
      baseline: BAR_BASE,
      labels: [
        { y: TOP, text: whole(max, currency), tone: 'meta' },
        ...(evenY === null
          ? []
          : [{ y: evenY, text: whole(evenPace!, currency), tone: 'ink' as const }]),
        { y: BAR_BASE, text: whole(0, currency), tone: 'meta' },
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
          : ` ${today - over} of ${today} days stayed at or under the even pace of ${whole(evenPace, currency)}.`),
    };
  }

  const right = width - LINE_RIGHT_INSET;
  const step = (right - LINE_LEFT) / days;
  const xOf = (day: number) => LINE_LEFT + day * step;
  const values = mode === 'pace' ? cumulative(series.values) : [...series.values];
  const ticks = [
    { x: LINE_LEFT, text: `1 ${short}`, today: false },
    ...(today && endsToday ? [{ x: xOf(today), text: 'Today', today: true }] : []),
    { x: right, ...lastTick },
  ];

  if (mode === 'balance') {
    const low = values.length ? Math.min(...values) : 0;
    const high = values.length ? Math.max(...values) : 0;
    const range = Math.max(high - low, 100);
    const unit = 10 ** Math.floor(Math.log10(range));
    const floor = Math.floor(low / unit) * unit;
    const half = Math.max(Math.ceil((high - floor) / 2 / unit) * unit, unit);
    const ceiling = floor + half * 2;
    const yOf = (minor: number) => LINE_BASE - ((minor - floor) / (ceiling - floor)) * (LINE_BASE - TOP);
    const points = values.map((value, index) => {
      const date = endsToday && index === today - 1 ? 'Today' : dayDate(month, index + 1);
      return {
        x: xOf(index + 1),
        y: yOf(value),
        date,
        value: money(value),
        accessibilityLabel: `${dayDate(month, index + 1)}, ${money(value)}`,
      };
    });
    return {
      mode,
      width,
      top: TOP,
      baseline: LINE_BASE,
      labels: [
        { y: TOP, text: whole(ceiling, currency), tone: 'meta' },
        { y: (TOP + LINE_BASE) / 2, text: whole(floor + half, currency), tone: 'meta' },
        { y: LINE_BASE, text: whole(floor, currency), tone: 'meta' },
      ],
      points,
      line: points,
      evenPace: null,
      budgetY: null,
      bars: [],
      safe: null,
      ticks,
      accessibilityLabel: values.length
        ? `Closing balance, 1 to ${today} ${name}, from ${money(values[0]!)} to ${money(values[today - 1]!)}. The axis starts at ${whole(floor, currency)}, not zero.`
        : `Closing balance in ${name}.`,
    };
  }

  const spent = values[today - 1] ?? 0;
  const max = Math.max(budget ?? 0, niceCeil(Math.max(...values, 0)), 1);
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
          { y: TOP, text: whole(budget, currency), tone: 'mint' },
          { y: (TOP + LINE_BASE) / 2, text: whole(budget / 2, currency), tone: 'meta' },
        ]
      : [
          { y: TOP, text: whole(max, currency), tone: 'meta' },
          ...(budgetY === null ? [] : [{ y: budgetY, text: whole(budget!, currency), tone: 'mint' as const }]),
        ];
  return {
    mode,
    width,
    top: TOP,
    baseline: LINE_BASE,
    labels: [...labels, { y: LINE_BASE, text: whole(0, currency), tone: 'meta' as const }].filter(
      (label, index, all) => index === all.length - 1 || label.text !== all[all.length - 1]!.text,
    ),
    points,
    line: [{ x: LINE_LEFT, y: LINE_BASE }, ...points],
    evenPace: budgetY === null ? null : { x1: LINE_LEFT, y1: LINE_BASE, x2: right, y2: budgetY },
    budgetY,
    bars: [],
    safe: null,
    ticks,
    accessibilityLabel:
      `${what ?? `Spent so far in ${name}`}, ${money(spent)}` +
      (budget === null
        ? '.'
        : `, against the ${whole(budget, currency)} budget. Dashed line is an even pace.`),
  };
}

/** Index of the point nearest `x`, for taps and drags. */
export function nearestIndex(xs: readonly number[], x: number): number {
  'worklet';
  let best = 0;
  for (let index = 1; index < xs.length; index++) {
    if (Math.abs(xs[index]! - x) < Math.abs(xs[best]! - x)) best = index;
  }
  return best;
}

/** Callout left edge: centred on `x`, kept inside the plot right of the axis. */
export function calloutLeft(x: number, width: number): number {
  return Math.max(AXIS_WIDTH + 4, Math.min(width - 100, x - 50));
}

export function polylineLength(points: readonly { x: number; y: number }[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    length += Math.hypot(points[index]!.x - points[index - 1]!.x, points[index]!.y - points[index - 1]!.y);
  }
  return length;
}
