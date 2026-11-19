import { addDays, type Calendar } from '../calendar';
import type { ChartRange } from '../chart-range';
import { chartTicks, dateLabel, formatMoney } from '../glossary';
import { balanceViewport, type BalanceIndex } from '../read-model/balance-history';
import { niceCeil, type ChartBox, type ChartDay, type ChartLabel, type ChartTickMark, type Point } from './month-charts';

const TODAY_CLEARANCE = 52;
const SIDE = 6;

export type BalanceChart = {
  labels: ChartLabel[];
  rows: number[];
  grid: { left: number; right: number; top: number; base: number };
  line: Point[];
  area: string;
  ticks: ChartTickMark[];
  days: ChartDay[];
  /** Today's balance less the first day's in the range. */
  changeMinor: number;
};

/**
 * The web's balance line over a range ending today: net worth (`total`) on All wallets, or one wallet's
 * closing balance per day on its page. The y axis takes four nice steps and reaches below zero when a
 * card or an overdrawn wallet does.
 */
export function balanceChart({
  index,
  series,
  now,
  range,
  calendar,
  currency,
  box,
}: {
  index: BalanceIndex;
  series: 'total' | string;
  now: Date;
  range: ChartRange;
  calendar: Calendar;
  currency: string;
  box: ChartBox;
}): BalanceChart {
  const values = series === 'total' ? index.total : (index.byWallet[series] ?? new Float64Array(index.days).fill(NaN));
  const { from, to } = balanceViewport(index, now, range, calendar);
  const shown: { day: number; value: number }[] = [];
  for (let day = from; day <= to; day++) if (!Number.isNaN(values[day])) shown.push({ day, value: values[day]! });
  const left = box.axis + SIDE;
  const right = box.width - SIDE;
  const top = box.top;
  const base = box.height - box.bottom;
  const low = Math.min(0, ...shown.map((point) => point.value));
  const high = Math.max(0, ...shown.map((point) => point.value));
  const bottom = low < 0 ? -niceCeil(-low) : 0;
  const step = niceCeil((high - bottom) / 4) || 100;
  const xOf = (day: number) => left + ((right - left) * (day - from)) / Math.max(to - from, 1);
  const yOf = (minor: number) => base - ((base - top) * (minor - bottom)) / (step * 4);
  const rows = [0, 1, 2, 3, 4].map((row) => bottom + step * row);
  const line = shown.map((point) => ({ x: xOf(point.day), y: yOf(point.value) }));
  const today = calendar.dayKey(now);
  const zeroY = yOf(Math.max(bottom, 0));
  const marks = chartTicks({ range, firstDay: index.firstDay, first: from, last: to })
    .map((tick) => ({ x: xOf(tick.day), text: tick.label, today: false }))
    .filter((mark) => Math.abs(mark.x - xOf(to)) >= TODAY_CLEARANCE);
  return {
    labels: rows.map((value) => ({ y: yOf(value), text: formatMoney(value, currency, { whole: true }), tone: 'meta' })),
    rows: rows.map(yOf),
    grid: { left, right, top, base },
    line,
    area: line.length
      ? `M${line[0]!.x.toFixed(1)},${zeroY.toFixed(1)} L${line.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' L')} L${line.at(-1)!.x.toFixed(1)},${zeroY.toFixed(1)} Z`
      : '',
    ticks: [...marks, { x: xOf(to), text: 'Today', today: true }],
    days: shown.map((point) => ({
      day: point.day,
      x: xOf(point.day),
      y: yOf(point.value),
      date: dateLabel(addDays(index.firstDay, point.day), today),
      value: formatMoney(point.value, currency),
    })),
    changeMinor: shown.length ? shown.at(-1)!.value - shown[0]!.value : 0,
  };
}
