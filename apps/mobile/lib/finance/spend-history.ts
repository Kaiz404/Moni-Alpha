import type { CurrencyCode } from '@repo/types';

import { parseLocalDateInput, toLocalDateInput } from '@/lib/dates/local-date-input';
import { countsAsSpend } from '@/lib/finance/budget-month';
import { chartRangeStart, type ChartRange } from '@/lib/finance/chart-range';
import type { FinanceTransaction } from '@/lib/finance/types';

export type SpendUnit = 'day' | 'week' | 'month' | 'year';

/** Local `YYYY-MM-DD`, both ends included. */
export type SpendBucket = { from: string; to: string; spentMinor: number };

/** Spending over a chart range, oldest first. The last day is today. */
export type SpendHistory = {
  days: { day: string; spentMinor: number }[];
  /** The same spending in as many bars as fit: one a day up to a month, then wider. */
  buckets: SpendBucket[];
  unit: SpendUnit;
};

const MOST_DAILY_DAYS = 31;
const MOST_WEEKLY_DAYS = 120;
const MOST_MONTHLY_DAYS = 732;

function unitFor(dayCount: number): SpendUnit {
  if (dayCount <= MOST_DAILY_DAYS) return 'day';
  if (dayCount <= MOST_WEEKLY_DAYS) return 'week';
  return dayCount <= MOST_MONTHLY_DAYS ? 'month' : 'year';
}

function bucketKey(day: string, index: number, unit: SpendUnit): string {
  if (unit === 'day') return day;
  if (unit === 'week') return String(Math.floor(index / 7));
  return unit === 'month' ? day.slice(0, 7) : day.slice(0, 4);
}

export function spendHistory({
  now,
  range,
  transactions,
  currency,
}: {
  now: Date;
  range: ChartRange;
  transactions: readonly FinanceTransaction[];
  currency: CurrencyCode;
}): SpendHistory {
  const today = toLocalDateInput(now);
  const byDay = new Map<string, number>();
  for (const transaction of transactions) {
    if (!countsAsSpend(transaction, currency)) continue;
    const day = toLocalDateInput(new Date(transaction.transactionDate));
    if (day <= today) byDay.set(day, (byDay.get(day) ?? 0) + Number(transaction.amountMinor));
  }
  const first =
    chartRangeStart(now, range) ?? [...byDay.keys()].reduce((a, b) => (b < a ? b : a), today);
  const start = parseLocalDateInput(first) ?? now;
  const days: SpendHistory['days'] = [];
  // Calendar arithmetic, not 24-hour steps, so a daylight saving change cannot skip or repeat a day.
  for (let forward = 0; ; forward++) {
    const day = toLocalDateInput(
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + forward),
    );
    if (day > today) break;
    days.push({ day, spentMinor: byDay.get(day) ?? 0 });
  }

  const unit = unitFor(days.length);
  const buckets: SpendBucket[] = [];
  let openKey: string | null = null;
  days.forEach(({ day, spentMinor }, index) => {
    const key = bucketKey(day, index, unit);
    const open = buckets.at(-1);
    if (open && key === openKey) {
      open.to = day;
      open.spentMinor += spentMinor;
    } else {
      buckets.push({ from: day, to: day, spentMinor });
      openKey = key;
    }
  });
  return { days, buckets, unit };
}
