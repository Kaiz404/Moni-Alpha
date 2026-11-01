import type { CurrencyCode, MerchantAlias, MinorAmount } from '@repo/types';

import { formatDate } from '@/lib/dates/day-label';
import { parseLocalDateInput, toLocalDateInput } from '@/lib/dates/local-date-input';
import {
  countsAsSpend,
  daysInMonth,
  monthKey,
  monthShort,
  shiftMonth,
  topMerchants,
  type MerchantSpend,
  type MonthKey,
} from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';
import { merchantName } from '@/lib/finance/merchant-name';
import type { FinanceCategory, FinanceTransaction } from '@/lib/finance/types';

/** Local `YYYY-MM-DD` days, both ends included. */
export type ReportRange = { from: string; to: string };

export type ReportPeriod = { kind: 'month'; month: MonthKey } | ({ kind: 'custom' } & ReportRange);

/** What a period is measured against, and the words for it: "Sep", "Sep by now". */
export type ReportComparison = { range: ReportRange; label: string };

export type ReportCategory = {
  /** Null for spending with no category. */
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  spentMinor: MinorAmount;
  previousMinor: MinorAmount;
};

export type ReportMerchant = MerchantSpend & {
  /** The category of its newest payment, for the bubble. */
  categoryId: string | null;
};

export type ReportMonth = { month: MonthKey; spentMinor: MinorAmount; inMinor: MinorAmount };

export type Report = {
  period: ReportPeriod;
  range: ReportRange;
  comparison: ReportComparison;
  currency: CurrencyCode;
  spentMinor: MinorAmount;
  inMinor: MinorAmount;
  previousSpentMinor: MinorAmount;
  /** Biggest first; together they add up to `spentMinor`. */
  categories: ReportCategory[];
  merchants: ReportMerchant[];
  merchantCount: number;
  /** Oldest first, ending at the period's last month. */
  trend: ReportMonth[];
};

export type ReportInput = {
  period: ReportPeriod;
  now: Date;
  currency: CurrencyCode;
  transactions: readonly FinanceTransaction[];
  /** Every category, archived ones too: old spending still belongs to them. */
  categories: readonly FinanceCategory[];
  aliases: readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[];
};

export const TREND_MONTHS = 6;
const TOP_MERCHANTS = 5;
const DAY_MS = 86_400_000;

const pad = (value: number) => String(value).padStart(2, '0');

/** Money in that counts: income, not balance corrections or debt cash (same as Activity's day totals). */
export function countsAsIncome(transaction: FinanceTransaction, currency: CurrencyCode): boolean {
  return (
    transaction.type === 'income' &&
    transaction.currency === currency &&
    !transaction.analysisExcluded &&
    !transaction.debtActivityId
  );
}

export function periodRange(period: ReportPeriod): ReportRange {
  if (period.kind === 'month') {
    return { from: `${period.month}-01`, to: `${period.month}-${pad(daysInMonth(period.month))}` };
  }
  return period.from <= period.to
    ? { from: period.from, to: period.to }
    : { from: period.to, to: period.from };
}

function dayCount({ from, to }: ReportRange): number {
  const start = parseLocalDateInput(from);
  const end = parseLocalDateInput(to);
  if (!start || !end) return 1;
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

/**
 * A past month against the whole month before. The running month against the same days of the
 * month before, as Activity's "than Sep by now" does. A custom period against the days just before it.
 */
export function comparisonFor(period: ReportPeriod, now: Date): ReportComparison {
  if (period.kind === 'month') {
    const previous = shiftMonth(period.month, -1);
    const name = monthShort(previous);
    const whole = periodRange({ kind: 'month', month: previous });
    if (period.month !== monthKey(now)) return { range: whole, label: name };
    const day = Math.min(now.getDate(), daysInMonth(previous));
    return {
      range: { from: whole.from, to: `${previous}-${pad(day)}` },
      label: `${name} by now`,
    };
  }
  const range = periodRange(period);
  const days = dayCount(range);
  const start = parseLocalDateInput(range.from) ?? now;
  const before = (offset: number) =>
    toLocalDateInput(new Date(start.getFullYear(), start.getMonth(), start.getDate() - offset));
  return {
    range: { from: before(days), to: before(1) },
    label: days === 1 ? 'the day before' : `the ${days} days before`,
  };
}

/** "RM20.50 more than Sep by now", "Same as Sep", or null with nothing to compare against. */
export function changePhrase(
  spentMinor: number,
  previousMinor: number,
  comparison: ReportComparison,
  currency: string,
): string | null {
  if (previousMinor === 0) return null;
  const change = spentMinor - previousMinor;
  if (change === 0) return `Same as ${comparison.label}`;
  const amount = formatMoney(Math.abs(change), currency);
  return `${amount} ${change > 0 ? 'more' : 'less'} than ${comparison.label}`;
}

/** A custom period's name: "Thu 1 Oct to Wed 14 Oct". */
export function rangeLabel({ from, to }: ReportRange, now: Date): string {
  const start = parseLocalDateInput(from);
  const end = parseLocalDateInput(to);
  if (!start || !end) return `${from} to ${to}`;
  return from === to
    ? formatDate(start, now)
    : `${formatDate(start, now)} to ${formatDate(end, now)}`;
}

type Dated = { transaction: FinanceTransaction; day: string };

const within = (day: string, { from, to }: ReportRange) => day >= from && day <= to;

function sum(rows: readonly Dated[]): number {
  return rows.reduce((total, row) => total + Number(row.transaction.amountMinor), 0);
}

function byCategory(rows: readonly Dated[]): Map<string | null, number> {
  const totals = new Map<string | null, number>();
  for (const { transaction } of rows) {
    totals.set(
      transaction.categoryId,
      (totals.get(transaction.categoryId) ?? 0) + Number(transaction.amountMinor),
    );
  }
  return totals;
}

export function buildReport(input: ReportInput): Report {
  const { period, now, currency } = input;
  const range = periodRange(period);
  const comparison = comparisonFor(period, now);

  const spend: Dated[] = [];
  const income: Dated[] = [];
  for (const transaction of input.transactions) {
    const isSpend = countsAsSpend(transaction, currency);
    if (!isSpend && !countsAsIncome(transaction, currency)) continue;
    (isSpend ? spend : income).push({
      day: toLocalDateInput(new Date(transaction.transactionDate)),
      transaction: transaction.merchant
        ? { ...transaction, merchant: merchantName(transaction.merchant, input.aliases) }
        : transaction,
    });
  }

  const current = spend.filter((row) => within(row.day, range));
  const previous = spend.filter((row) => within(row.day, comparison.range));

  const categoriesById = new Map(input.categories.map((category) => [category.id, category]));
  const previousByCategory = byCategory(previous);
  const categories = [...byCategory(current)]
    .map(([categoryId, spentMinor]): ReportCategory => {
      const category = categoryId ? categoriesById.get(categoryId) : undefined;
      return {
        categoryId,
        name: category?.name ?? 'Uncategorized',
        icon: category?.icon ?? null,
        color: category?.color ?? null,
        spentMinor: spentMinor as MinorAmount,
        previousMinor: (previousByCategory.get(categoryId) ?? 0) as MinorAmount,
      };
    })
    .sort((a, b) => b.spentMinor - a.spentMinor || a.name.localeCompare(b.name));

  const newestFirst = [...current].sort((a, b) =>
    b.transaction.transactionDate.localeCompare(a.transaction.transactionDate),
  );
  const { merchants, count } = topMerchants(
    newestFirst.map((row) => row.transaction),
    TOP_MERCHANTS,
  );

  const lastMonth = range.to.slice(0, 7);
  const trend = Array.from({ length: TREND_MONTHS }, (_, index): ReportMonth => {
    const month = shiftMonth(lastMonth, index - TREND_MONTHS + 1);
    const inMonth = (row: Dated) => row.day.startsWith(`${month}-`);
    return {
      month,
      spentMinor: sum(spend.filter(inMonth)) as MinorAmount,
      inMinor: sum(income.filter(inMonth)) as MinorAmount,
    };
  });

  return {
    period,
    range,
    comparison,
    currency,
    spentMinor: sum(current) as MinorAmount,
    inMinor: sum(income.filter((row) => within(row.day, range))) as MinorAmount,
    previousSpentMinor: sum(previous) as MinorAmount,
    categories,
    merchants: merchants.map((merchant) => ({
      ...merchant,
      categoryId:
        newestFirst.find(
          ({ transaction }) => (transaction.merchant ?? transaction.description) === merchant.name,
        )?.transaction.categoryId ?? null,
    })),
    merchantCount: count,
    trend,
  };
}
