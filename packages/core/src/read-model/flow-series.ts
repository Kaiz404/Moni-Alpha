import { addMinor, type CurrencyCode, type MinorAmount } from '@repo/types';

import {
  addDays,
  type Calendar,
  dayOfMonth,
  daysBetween,
  type MonthKey,
  shiftMonth,
} from '../calendar';
import { monthShort, shortDate } from '../glossary';
import { countsAsCashFlow, countsAsSpending } from '../ledger';
import { monthRange, rangeLabel, type ActivityRange } from './activity-filter';
import type { FinanceTransaction } from './types';

export type FlowBucket = {
  key: string;
  label: string;
  /** Local `YYYY-MM-DD`, both ends included. */
  from: string;
  to: string;
  spentMinor: MinorAmount;
  inMinor: MinorAmount;
};

export type FlowSeries = {
  range: ActivityRange;
  label: string;
  spentMinor: MinorAmount;
  inMinor: MinorAmount;
  buckets: FlowBucket[];
};

const LEAST_MONTHS = 6;
const MOST_DAILY_DAYS = 14;
const MOST_WEEKLY_DAYS = 98;
const MOST_MONTHLY_DAYS = 732;

function allTime(
  transactions: readonly FinanceTransaction[],
  now: Date,
  currency: CurrencyCode,
  calendar: Calendar,
): ActivityRange {
  const month = calendar.monthKey(now);
  let first = shiftMonth(month, 1 - LEAST_MONTHS);
  for (const transaction of transactions) {
    if (transaction.currency !== currency || !countsAsCashFlow(transaction)) continue;
    const at = calendar.monthKey(transaction.transactionDate);
    if (at < first) first = at;
  }
  return { from: monthRange(first).from, to: monthRange(month).to };
}

function empty(key: string, label: string, from: string, to: string): FlowBucket {
  return { key, label, from, to, spentMinor: 0 as MinorAmount, inMinor: 0 as MinorAmount };
}

function bucketsOf({ from, to }: ActivityRange): FlowBucket[] {
  const days = daysBetween(from, to) + 1;
  const buckets: FlowBucket[] = [];
  if (days <= MOST_WEEKLY_DAYS) {
    const step = days <= MOST_DAILY_DAYS ? 1 : 7;
    for (let start = 0; start < days; start += step) {
      const first = addDays(from, start);
      const last = addDays(from, Math.min(start + step, days) - 1);
      const label = step === 1 ? String(dayOfMonth(first)) : shortDate(first);
      buckets.push(empty(first, label, first, last));
    }
    return buckets;
  }
  if (days <= MOST_MONTHLY_DAYS) {
    const end = to.slice(0, 7) as MonthKey;
    for (let month = from.slice(0, 7) as MonthKey; month <= end; month = shiftMonth(month, 1)) {
      const whole = monthRange(month);
      buckets.push(
        empty(
          month,
          monthShort(month),
          whole.from < from ? from : whole.from,
          whole.to > to ? to : whole.to,
        ),
      );
    }
    return buckets;
  }
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year += 1) {
    const whole = { from: `${year}-01-01`, to: `${year}-12-31` };
    buckets.push(
      empty(
        String(year),
        String(year),
        whole.from < from ? from : whole.from,
        whole.to > to ? to : whole.to,
      ),
    );
  }
  return buckets;
}

/**
 * Spent against Money in over a range, in bars of a size that stays readable at that span: days
 * up to two weeks, weeks up to about three months, months up to two years, then years. A null
 * range is all time: from the month of the first row that counts, and never less than the last
 * six months. Rows count as they do on Budget.
 */
export function flowSeries({
  transactions,
  range,
  now,
  currency,
  calendar,
}: {
  transactions: readonly FinanceTransaction[];
  range: ActivityRange | null;
  now: Date;
  currency: CurrencyCode;
  calendar: Calendar;
}): FlowSeries {
  const drawn = range ?? allTime(transactions, now, currency, calendar);
  const buckets = bucketsOf(drawn);
  const starts = buckets.map((bucket) => calendar.startOfDay(bucket.from).getTime());
  const end = calendar.startOfDay(addDays(drawn.to, 1)).getTime();
  let spentMinor = 0 as MinorAmount;
  let inMinor = 0 as MinorAmount;
  for (const transaction of transactions) {
    if (transaction.currency !== currency || !countsAsCashFlow(transaction)) continue;
    const spends = countsAsSpending(transaction);
    const at = new Date(transaction.transactionDate).getTime();
    if (at < starts[0]! || at >= end) continue;
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (starts[middle]! <= at) low = middle;
      else high = middle - 1;
    }
    const bucket = buckets[low]!;
    if (spends) {
      bucket.spentMinor = addMinor(bucket.spentMinor, transaction.amountMinor);
      spentMinor = addMinor(spentMinor, transaction.amountMinor);
    } else {
      bucket.inMinor = addMinor(bucket.inMinor, transaction.amountMinor);
      inMinor = addMinor(inMinor, transaction.amountMinor);
    }
  }
  return {
    range: drawn,
    label: range ? rangeLabel(range, now, calendar) : 'All time',
    spentMinor,
    inMinor,
    buckets,
  };
}
