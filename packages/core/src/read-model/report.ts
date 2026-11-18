import type { CurrencyCode, MerchantAlias, MinorAmount } from '@repo/types';

import {
  addDays,
  type Calendar,
  dayOfMonth,
  daysInMonth,
  firstDayOf,
  isMonthKey,
  lastDayOf,
  type MonthKey,
  parseDayKey,
  shiftMonth,
} from '../calendar';
import { formatMoney, monthShort } from '../glossary';
import { countsAsSpending } from '../ledger';
import { merchantName, topMerchants, type MerchantSpend } from './merchants';
import type { FinanceCategory, FinanceTransaction } from './types';

type Aliases = readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[];

/**
 * Which of a month's spending a Budget row adds up, for the page that lists those payments. A
 * merchant on a category page counts only that category, so it carries the category too.
 */
export type SpendingScope =
  | { kind: 'category'; categoryId: string | null }
  | { kind: 'merchant'; name: string; categoryId?: string }
  | { kind: 'day'; day: string };

export type SpendingParams = {
  month?: string;
  categoryId?: string;
  merchant?: string;
  day?: string;
};

/** `categoryId` in the spending page's params for spending with no category. */
const NO_CATEGORY = 'none';

/** The same words the ring and the transaction rows use. */
export const NO_CATEGORY_NAME = 'No category';

/** Local `YYYY-MM-DD` days, both ends included. */
export type ReportRange = { from: string; to: string };

/** What a month is measured against, and the words for it: "Sep", "Sep by now". */
export type ReportComparison = { range: ReportRange; label: string };

export type ReportCategory = {
  /** Null for spending with no category. */
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  spentMinor: MinorAmount;
};

export type ReportMerchant = MerchantSpend & {
  /** The category of its newest payment, for the bubble. */
  icon: string | null;
  color: string | null;
};

export type Report = {
  /** Biggest first; together they add up to the month's spending. */
  categories: ReportCategory[];
  merchants: ReportMerchant[];
  merchantCount: number;
};

export type ReportInput = {
  month: MonthKey;
  currency: CurrencyCode;
  transactions: readonly FinanceTransaction[];
  /** Every category, archived ones too: old spending still belongs to them. */
  categories: readonly Pick<FinanceCategory, 'id' | 'name' | 'icon' | 'color'>[];
  aliases: Aliases;
  calendar: Calendar;
};

const TOP_MERCHANTS = 5;

function monthRange(month: MonthKey): ReportRange {
  return { from: firstDayOf(month), to: lastDayOf(month) };
}

/**
 * A past month against the whole month before. The running month against the same days of the
 * month before, as Activity's "than Sep by now" does.
 */
export function comparisonFor(month: MonthKey, now: Date, calendar: Calendar): ReportComparison {
  const previous = shiftMonth(month, -1);
  const name = monthShort(previous);
  const whole = monthRange(previous);
  if (month !== calendar.monthKey(now)) return { range: whole, label: name };
  const day = Math.min(dayOfMonth(calendar.dayKey(now)), daysInMonth(previous));
  return {
    range: { from: whole.from, to: addDays(firstDayOf(previous), day - 1) },
    label: `${name} by now`,
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

const dayOf = (transaction: FinanceTransaction, calendar: Calendar) =>
  calendar.dayKey(transaction.transactionDate);

const within = (transaction: FinanceTransaction, { from, to }: ReportRange, calendar: Calendar) =>
  dayOf(transaction, calendar) >= from && dayOf(transaction, calendar) <= to;

function byCategory(transactions: readonly FinanceTransaction[]): Map<string | null, number> {
  const totals = new Map<string | null, number>();
  for (const transaction of transactions) {
    totals.set(
      transaction.categoryId,
      (totals.get(transaction.categoryId) ?? 0) + Number(transaction.amountMinor),
    );
  }
  return totals;
}

function isInScope(transaction: FinanceTransaction, scope: SpendingScope, calendar: Calendar): boolean {
  switch (scope.kind) {
    case 'category':
      return transaction.categoryId === scope.categoryId;
    case 'merchant':
      return (
        (transaction.merchant ?? transaction.description) === scope.name &&
        (scope.categoryId === undefined || transaction.categoryId === scope.categoryId)
      );
    case 'day':
      return dayOf(transaction, calendar) === scope.day;
  }
}

/** A month's payments in a scope, newest first, under the names the user gave their merchants. */
export function spendingRows(
  scope: SpendingScope,
  month: MonthKey,
  transactions: readonly FinanceTransaction[],
  currency: CurrencyCode,
  aliases: Aliases,
  calendar: Calendar,
): FinanceTransaction[] {
  return namedMonthSpend(transactions, month, currency, aliases, calendar).filter((transaction) =>
    isInScope(transaction, scope, calendar),
  );
}

/** A month's spending in one currency, newest first; `categoryId` narrows it to one category. */
export function monthSpend(
  transactions: readonly FinanceTransaction[],
  month: MonthKey,
  currency: CurrencyCode,
  calendar: Calendar,
  categoryId?: string,
): FinanceTransaction[] {
  return transactions
    .filter(
      (transaction) =>
        transaction.currency === currency && countsAsSpending(transaction) &&
        (categoryId === undefined || transaction.categoryId === categoryId) &&
        calendar.monthKey(transaction.transactionDate) === month,
    )
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

/** A month's spending, newest first, under the names the user gave their merchants. */
function namedMonthSpend(
  transactions: readonly FinanceTransaction[],
  month: MonthKey,
  currency: CurrencyCode,
  aliases: Aliases,
  calendar: Calendar,
): FinanceTransaction[] {
  return monthSpend(transactions, month, currency, calendar).map((transaction) =>
    transaction.merchant
      ? { ...transaction, merchant: merchantName(transaction.merchant, aliases) }
      : transaction,
  );
}

/** Every merchant a month's spending went to, biggest first, with the category of its newest payment. */
export function monthMerchants(
  input: Pick<
    ReportInput,
    'month' | 'currency' | 'transactions' | 'categories' | 'aliases' | 'calendar'
  >,
): ReportMerchant[] {
  const current = namedMonthSpend(
    input.transactions,
    input.month,
    input.currency,
    input.aliases,
    input.calendar,
  );
  const categoriesById = new Map(input.categories.map((category) => [category.id, category]));
  return topMerchants(current, Infinity).merchants.map((merchant) => {
    const newest = current.find(
      (transaction) => (transaction.merchant ?? transaction.description) === merchant.name,
    );
    const category = newest?.categoryId ? categoriesById.get(newest.categoryId) : undefined;
    return { ...merchant, icon: category?.icon ?? null, color: category?.color ?? null };
  });
}

export function totalMinor(transactions: readonly FinanceTransaction[]): MinorAmount {
  return transactions.reduce(
    (total, transaction) => total + Number(transaction.amountMinor),
    0,
  ) as MinorAmount;
}

/** The month-over-month phrase for a scope. A single day has no month to compare with. */
export function spendingChange(
  scope: SpendingScope,
  month: MonthKey,
  now: Date,
  transactions: readonly FinanceTransaction[],
  currency: CurrencyCode,
  aliases: Aliases,
  calendar: Calendar,
): string | null {
  if (scope.kind === 'day') return null;
  const comparison = comparisonFor(month, now, calendar);
  const previous = spendingRows(
    scope,
    shiftMonth(month, -1),
    transactions,
    currency,
    aliases,
    calendar,
  ).filter((transaction) => within(transaction, comparison.range, calendar));
  return changePhrase(
    totalMinor(spendingRows(scope, month, transactions, currency, aliases, calendar)),
    totalMinor(previous),
    comparison,
    currency,
  );
}

export function spendingParams(scope: SpendingScope, month: MonthKey): SpendingParams {
  switch (scope.kind) {
    case 'category':
      return { month, categoryId: scope.categoryId ?? NO_CATEGORY };
    case 'merchant':
      return {
        month,
        merchant: scope.name,
        ...(scope.categoryId === undefined ? {} : { categoryId: scope.categoryId }),
      };
    case 'day':
      return { month, day: scope.day };
  }
}

/** The page's scope and month, or null when its params name no spending. A bad month is this month. */
export function readSpendingParams(
  params: SpendingParams,
  thisMonth: MonthKey,
): { scope: SpendingScope; month: MonthKey } | null {
  const month = isMonthKey(params.month) ? params.month : thisMonth;
  if (params.merchant) {
    return {
      month,
      scope: {
        kind: 'merchant',
        name: params.merchant,
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      },
    };
  }
  if (params.categoryId) {
    return {
      month,
      scope: {
        kind: 'category',
        categoryId: params.categoryId === NO_CATEGORY ? null : params.categoryId,
      },
    };
  }
  if (params.day && parseDayKey(params.day)) {
    return { month: params.day.slice(0, 7), scope: { kind: 'day', day: params.day } };
  }
  return null;
}

export function buildReport(input: ReportInput): Report {
  const { month, currency, transactions, aliases, calendar } = input;
  const current = namedMonthSpend(transactions, month, currency, aliases, calendar);

  const categoriesById = new Map(input.categories.map((category) => [category.id, category]));
  const categories = [...byCategory(current)]
    .map(([categoryId, spentMinor]): ReportCategory => {
      const category = categoryId ? categoriesById.get(categoryId) : undefined;
      return {
        categoryId,
        name: category?.name ?? NO_CATEGORY_NAME,
        icon: category?.icon ?? null,
        color: category?.color ?? null,
        spentMinor: spentMinor as MinorAmount,
      };
    })
    .sort((a, b) => b.spentMinor - a.spentMinor || a.name.localeCompare(b.name));

  const merchants = monthMerchants(input);

  return {
    categories,
    merchants: merchants.slice(0, TOP_MERCHANTS),
    merchantCount: merchants.length,
  };
}
