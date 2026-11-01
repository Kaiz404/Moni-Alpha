import { addMinor, type CurrencyCode, type MinorAmount } from '@repo/types';

import { toLocalDateInput } from '@/lib/dates/local-date-input';
import {
  localDay,
  monthRange,
  rangeLabel,
  shortDay,
  type ActivityRange,
} from '@/lib/finance/activity-filter';
import {
  countsAsSpend,
  monthKey,
  monthShort,
  shiftMonth,
  type MonthKey,
} from '@/lib/finance/budget-month';
import type { FinanceTransaction } from '@/lib/finance/types';
import { countsAsIncome } from '@/lib/reports/report';

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

const LAST_MONTHS = 6;
const MOST_DAILY_DAYS = 14;
const MOST_WEEKLY_DAYS = 98;
const MOST_MONTHLY_DAYS = 732;

function empty(key: string, label: string, from: string, to: string): FlowBucket {
  return { key, label, from, to, spentMinor: 0 as MinorAmount, inMinor: 0 as MinorAmount };
}

function bucketsOf({ from, to }: ActivityRange): FlowBucket[] {
  const days = Math.round((localDay(to).getTime() - localDay(from).getTime()) / 86_400_000) + 1;
  const buckets: FlowBucket[] = [];
  if (days <= MOST_WEEKLY_DAYS) {
    const step = days <= MOST_DAILY_DAYS ? 1 : 7;
    for (let start = 0; start < days; start += step) {
      const first = toLocalDateInput(localDay(from, start));
      const last = toLocalDateInput(localDay(from, Math.min(start + step, days) - 1));
      const label = step === 1 ? String(localDay(first).getDate()) : shortDay(first);
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
 * range draws the last six months. Rows count as they do on Budget.
 */
export function flowSeries({
  transactions,
  range,
  now,
  currency,
}: {
  transactions: readonly FinanceTransaction[];
  range: ActivityRange | null;
  now: Date;
  currency: CurrencyCode;
}): FlowSeries {
  const month = monthKey(now);
  const drawn = range ?? {
    from: monthRange(shiftMonth(month, 1 - LAST_MONTHS)).from,
    to: monthRange(month).to,
  };
  const buckets = bucketsOf(drawn);
  const starts = buckets.map((bucket) => localDay(bucket.from).getTime());
  const end = localDay(drawn.to, 1).getTime();
  let spentMinor = 0 as MinorAmount;
  let inMinor = 0 as MinorAmount;
  for (const transaction of transactions) {
    const spends = countsAsSpend(transaction, currency);
    if (!spends && !countsAsIncome(transaction, currency)) continue;
    const at = new Date(transaction.transactionDate).getTime();
    if (at < starts[0] || at >= end) continue;
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (starts[middle] <= at) low = middle;
      else high = middle - 1;
    }
    const bucket = buckets[low];
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
    label: range ? rangeLabel(range, now) : `Last ${LAST_MONTHS} months`,
    spentMinor,
    inMinor,
    buckets,
  };
}
