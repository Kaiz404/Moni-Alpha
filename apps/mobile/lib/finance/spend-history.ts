import type { CurrencyCode } from '@repo/types';

import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { countsAsSpend } from '@/lib/finance/budget-month';
import { chartRangeStart, dateAt, dayNumber } from '@/lib/finance/chart-range';
import type { FinanceTransaction } from '@/lib/finance/types';

export type SpendUnit = 'day' | 'week' | 'month' | 'year';

/**
 * Spending per local day from `firstDay` to today, built once per change of the transactions and
 * sliced by every chart range. `firstDay` is the earlier of the first spend and a year ago, so the
 * 1M, 7D, 30D, 90D and 1Y ranges are all inside it.
 */
export type SpendIndex = {
  firstDay: string;
  /** Days in the index; the last one, `days - 1`, is today. */
  days: number;
  /** The first day with spending, or today when nothing was spent. */
  firstSpend: number;
  /** Minor units spent on each day. */
  spent: Float64Array;
  /** `cumulative[k]` is what was spent before day k, so it holds `days + 1` entries and ends on the total. */
  cumulative: Float64Array;
};

/**
 * The bars for one range: `unit`-wide buckets in day indices, both ends included. Day buckets cover
 * the whole index, since a day is the same bar in every range; wider ones start at the range start.
 */
export type SpendBuckets = {
  unit: SpendUnit;
  /** Two ranges with the same key draw the same bars. */
  key: string;
  starts: Float64Array;
  ends: Float64Array;
  values: Float64Array;
  /** The first bucket inside the range; the last bucket is always today's. */
  first: number;
};

const MOST_DAILY_DAYS = 31;
const MOST_WEEKLY_DAYS = 120;
const MOST_MONTHLY_DAYS = 732;

export function unitFor(dayCount: number): SpendUnit {
  if (dayCount <= MOST_DAILY_DAYS) return 'day';
  if (dayCount <= MOST_WEEKLY_DAYS) return 'week';
  return dayCount <= MOST_MONTHLY_DAYS ? 'month' : 'year';
}

export function spendIndex({
  now,
  transactions,
  currency,
}: {
  now: Date;
  transactions: readonly FinanceTransaction[];
  currency: CurrencyCode;
}): SpendIndex {
  const today = toLocalDateInput(now);
  const byDay = new Map<string, number>();
  let earliest = today;
  for (const transaction of transactions) {
    if (!countsAsSpend(transaction, currency)) continue;
    const day = toLocalDateInput(new Date(transaction.transactionDate));
    if (day > today) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + Number(transaction.amountMinor));
    if (day < earliest) earliest = day;
  }
  const yearAgo = chartRangeStart(now, '1y')!;
  const firstDay = earliest < yearAgo ? earliest : yearAgo;
  const origin = dayNumber(firstDay);
  const days = dayNumber(today) - origin + 1;
  const spent = new Float64Array(days);
  for (const [day, minor] of byDay) spent[dayNumber(day) - origin] = minor;
  const cumulative = new Float64Array(days + 1);
  for (let day = 0; day < days; day++) cumulative[day + 1] = cumulative[day]! + spent[day]!;
  return { firstDay, days, firstSpend: byDay.size ? dayNumber(earliest) - origin : days - 1, spent, cumulative };
}

/** The bars for a range that starts on day `from` and ends today. */
export function spendBuckets(index: SpendIndex, from: number): SpendBuckets {
  const last = index.days - 1;
  const unit = unitFor(last - from + 1);
  if (unit === 'day') {
    const days = Float64Array.from({ length: index.days }, (_, day) => day);
    return { unit, key: 'day', starts: days, ends: days, values: index.spent, first: from };
  }
  const starts: number[] = [];
  const ends: number[] = [];
  const values: number[] = [];
  let openKey = '';
  for (let day = from; day <= last; day++) {
    const date = dateAt(index.firstDay, day);
    const key =
      unit === 'week'
        ? String(Math.floor((day - from) / 7))
        : unit === 'month'
          ? `${date.getFullYear()}-${date.getMonth()}`
          : String(date.getFullYear());
    if (key === openKey) {
      ends[ends.length - 1] = day;
      values[values.length - 1]! += index.spent[day]!;
    } else {
      starts.push(day);
      ends.push(day);
      values.push(index.spent[day]!);
      openKey = key;
    }
  }
  return {
    unit,
    key: `${unit}:${from}`,
    starts: Float64Array.from(starts),
    ends: Float64Array.from(ends),
    values: Float64Array.from(values),
    first: 0,
  };
}
