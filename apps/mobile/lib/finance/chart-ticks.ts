import { dateAt, type ChartRange } from '@/lib/finance/chart-range';

/** An x-axis date label, anchored to day `day` of the chart's day index. */
export type ChartTick = { day: number; label: string };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Scheme = (date: Date) => string | null;

const SCHEMES: Record<Exclude<ChartRange, 'all'> | 'years', Scheme> = {
  '7d': (date) => WEEKDAYS[date.getDay()]!,
  '30d': (date) => (date.getDay() === 1 ? `${date.getDate()} ${MONTHS[date.getMonth()]}` : null),
  '1m': (date) => {
    const day = date.getDate();
    if (day === 1) return `1 ${MONTHS[date.getMonth()]}`;
    return (day - 1) % 7 === 0 ? String(day) : null;
  },
  '90d': (date) => (date.getDate() === 1 ? MONTHS[date.getMonth()]! : null),
  '1y': (date) => {
    if (date.getDate() !== 1 || date.getMonth() % 3 !== 0) return null;
    return date.getMonth() === 0 ? `Jan ${date.getFullYear()}` : MONTHS[date.getMonth()]!;
  },
  years: (date) =>
    date.getDate() === 1 && date.getMonth() === 0 ? String(date.getFullYear()) : null,
};

function monthsApart(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
  return to.getDate() < from.getDate() ? months - 1 : months;
}

/**
 * The date ticks a range shows over days `first` to `last` of an index that starts on `firstDay`
 * (tokens.md Charts). There is no first-day tick, since the range chip already says the span. The
 * chart adds Today itself and hides any tick too close to it.
 */
export function chartTicks({
  range,
  firstDay,
  first,
  last,
}: {
  range: ChartRange;
  firstDay: string;
  first: number;
  last: number;
}): ChartTick[] {
  const short = range === 'all' && monthsApart(dateAt(firstDay, first), dateAt(firstDay, last)) < 13;
  const scheme = SCHEMES[range === 'all' ? (short ? '1y' : 'years') : range];
  const ticks: ChartTick[] = [];
  for (let day = Math.max(first, 0); day <= last; day++) {
    const label = scheme(dateAt(firstDay, day));
    if (label !== null) ticks.push({ day, label });
  }
  return ticks;
}
