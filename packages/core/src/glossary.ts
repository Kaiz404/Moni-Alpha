/** The words and numbers docs/redesign/glossary.md fixes: money, days, due phrases, months, chart ticks. */
import { minorToNumber, type MinorAmount } from '@repo/types';

import {
  addDays,
  dayOfMonth,
  daysBetween,
  monthOf,
  monthsBetween,
  weekday,
  type DayKey,
  type MonthKey,
} from './calendar';
import type { ChartRange } from './chart-range';

const MINUS = '−';
/** Ringgit is RM, and a dollar always names its country (owner, 21 Nov 2026): US$120.00, never $120.00. */
const SYMBOLS: Record<string, string> = { MYR: 'RM', USD: 'US$', SGD: 'S$', BND: 'B$' };

function intlSymbol(code: string, display: 'symbol' | 'narrowSymbol'): string | undefined {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: display })
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value;
}

/**
 * The symbol money prints with. Intl's own symbol tells most dollars and yen apart (A$, CA$, CN¥); where it
 * only has the code, the narrow symbol stands in unless that is a bare "$".
 */
export function currencySymbol(currency: string): string {
  const code = currency.toUpperCase();
  const known = SYMBOLS[code];
  if (known) return known;
  try {
    const symbol = intlSymbol(code, 'symbol');
    if (symbol && symbol !== code) return symbol;
    const narrow = intlSymbol(code, 'narrowSymbol');
    return narrow && narrow !== '$' ? narrow : code;
  } catch {
    return code;
  }
}

/**
 * Glossary money: symbol with no space, thousands commas, U+2212 for negatives. `whole` rounds toward
 * zero for forward-looking numbers ("RM100 left"); money that exists keeps two decimals ("RM96.50").
 */
export function formatMoney(
  amount: MinorAmount | number,
  currency: string,
  { whole = false }: { whole?: boolean } = {},
): string {
  const value = minorToNumber(amount);
  const magnitude = Math.abs(value);
  const digits = whole
    ? Math.floor(magnitude).toLocaleString('en-US')
    : magnitude.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  return `${value < 0 ? MINUS : ''}${currencySymbol(currency)}${digits}`;
}

export type MoneyDirection = 'expense' | 'income' | 'transfer';

/** U+2212 for an expense, a plus for income, nothing for a transfer. */
export function moneySign(direction: MoneyDirection): string {
  return direction === 'expense' ? MINUS : direction === 'income' ? '+' : '';
}

/** A transaction amount: U+2212 for expenses, a plus for income, transfers unsigned. */
export function formatSignedMoney(
  direction: MoneyDirection,
  amount: MinorAmount | number,
  currency: string,
): string {
  return `${moneySign(direction)}${formatMoney(Math.abs(Number(amount)), currency)}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

/** "October". */
export function monthName(month: MonthKey): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? '';
}

/** "Oct"; September is "Sep". */
export function monthShort(month: MonthKey): string {
  return monthName(month).slice(0, 3);
}

/** "Fri". */
export function weekdayShort(day: DayKey): string {
  return WEEKDAYS[weekday(day)] ?? '';
}

/** "16 Oct", or "16 Oct 2025" `withYear`. */
export function shortDate(day: DayKey, withYear = false): string {
  const label = `${dayOfMonth(day)} ${monthShort(monthOf(day))}`;
  return withYear ? `${label} ${day.slice(0, 4)}` : label;
}

/** "Fri 16 Oct", with the year only outside `today`'s: "Tue 14 Oct 2025". */
export function dateLabel(day: DayKey, today: DayKey): string {
  const label = `${weekdayShort(day)} ${shortDate(day)}`;
  return day.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${day.slice(0, 4)}`;
}

function relativeDay(day: DayKey, today: DayKey): 'Today' | 'Yesterday' | null {
  const days = daysBetween(day, today);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : null;
}

/** "Today", "Yesterday", or the date. */
export function dayLabel(day: DayKey, today: DayKey): string {
  return relativeDay(day, today) ?? dateLabel(day, today);
}

/** A day group's heading: "Today, Wed 14 Oct", or the date alone. */
export function dayHeading(day: DayKey, today: DayKey): string {
  const relative = relativeDay(day, today);
  return relative ? `${relative}, ${dateLabel(day, today)}` : dateLabel(day, today);
}

/** "today", "tomorrow", or "on Fri 16 Oct"; a past day reads "today". */
export function dueWhen(due: DayKey, today: DayKey): string {
  const days = daysBetween(today, due);
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `on ${dateLabel(due, today)}`;
}

/** "In 6 days", "Tomorrow", "Today", "2 days late". */
export function dueWords(daysLeft: number): string {
  if (daysLeft > 1) return `In ${daysLeft} days`;
  if (daysLeft === 1) return 'Tomorrow';
  if (daysLeft === 0) return 'Today';
  return daysLeft === -1 ? '1 day late' : `${-daysLeft} days late`;
}

/** An x-axis date label, anchored to day `day` of the chart's day index. */
export type ChartTick = { day: number; label: string };

type Scheme = (day: DayKey) => string | null;

const SCHEMES: Record<Exclude<ChartRange, 'all'> | 'years', Scheme> = {
  '7d': (day) => weekdayShort(day),
  '30d': (day) => (weekday(day) === 1 ? shortDate(day) : null),
  '1m': (day) => {
    const date = dayOfMonth(day);
    if (date === 1) return shortDate(day);
    return (date - 1) % 7 === 0 ? String(date) : null;
  },
  '90d': (day) => (dayOfMonth(day) === 1 ? monthShort(monthOf(day)) : null),
  '1y': (day) => {
    const month = Number(day.slice(5, 7)) - 1;
    if (dayOfMonth(day) !== 1 || month % 3 !== 0) return null;
    return month === 0 ? `Jan ${day.slice(0, 4)}` : monthShort(monthOf(day));
  },
  years: (day) => (day.slice(5) === '01-01' ? day.slice(0, 4) : null),
};

function wholeMonthsApart(from: DayKey, to: DayKey): number {
  const months = monthsBetween(monthOf(from), monthOf(to));
  return dayOfMonth(to) < dayOfMonth(from) ? months - 1 : months;
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
  firstDay: DayKey;
  first: number;
  last: number;
}): ChartTick[] {
  const short =
    range === 'all' && wholeMonthsApart(addDays(firstDay, first), addDays(firstDay, last)) < 13;
  const scheme = SCHEMES[range === 'all' ? (short ? '1y' : 'years') : range];
  const ticks: ChartTick[] = [];
  for (let day = Math.max(first, 0); day <= last; day++) {
    const label = scheme(addDays(firstDay, day));
    if (label !== null) ticks.push({ day, label });
  }
  return ticks;
}
