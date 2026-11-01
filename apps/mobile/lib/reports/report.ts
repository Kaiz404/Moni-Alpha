import type { CurrencyCode, MerchantAlias, MinorAmount } from '@repo/types';

import { parseLocalDateInput, toLocalDateInput } from '@/lib/dates/local-date-input';
import {
  daysInMonth,
  isMonthKey,
  monthKey,
  monthShort,
  monthSpend,
  shiftMonth,
  topMerchants,
  type MerchantSpend,
  type MonthKey,
} from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';
import { merchantName } from '@/lib/finance/merchant-name';
import type { FinanceCategory, FinanceTransaction } from '@/lib/finance/types';

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
  previousMinor: MinorAmount;
};

export type ReportMerchant = MerchantSpend & {
  /** The category of its newest payment, for the bubble. */
  icon: string | null;
  color: string | null;
};

export type Report = {
  comparison: ReportComparison;
  /** Biggest first; together they add up to the month's spending. */
  categories: ReportCategory[];
  merchants: ReportMerchant[];
  merchantCount: number;
};

export type ReportInput = {
  month: MonthKey;
  now: Date;
  currency: CurrencyCode;
  transactions: readonly FinanceTransaction[];
  /** Every category, archived ones too: old spending still belongs to them. */
  categories: readonly Pick<FinanceCategory, 'id' | 'name' | 'icon' | 'color'>[];
  aliases: Aliases;
};

const TOP_MERCHANTS = 5;

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

function monthRange(month: MonthKey): ReportRange {
  return { from: `${month}-01`, to: `${month}-${pad(daysInMonth(month))}` };
}

/**
 * A past month against the whole month before. The running month against the same days of the
 * month before, as Activity's "than Sep by now" does.
 */
export function comparisonFor(month: MonthKey, now: Date): ReportComparison {
  const previous = shiftMonth(month, -1);
  const name = monthShort(previous);
  const whole = monthRange(previous);
  if (month !== monthKey(now)) return { range: whole, label: name };
  const day = Math.min(now.getDate(), daysInMonth(previous));
  return {
    range: { from: whole.from, to: `${previous}-${pad(day)}` },
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

const dayOf = (transaction: FinanceTransaction) =>
  toLocalDateInput(new Date(transaction.transactionDate));

const within = (transaction: FinanceTransaction, { from, to }: ReportRange) =>
  dayOf(transaction) >= from && dayOf(transaction) <= to;

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

function isInScope(transaction: FinanceTransaction, scope: SpendingScope): boolean {
  switch (scope.kind) {
    case 'category':
      return transaction.categoryId === scope.categoryId;
    case 'merchant':
      return (
        (transaction.merchant ?? transaction.description) === scope.name &&
        (scope.categoryId === undefined || transaction.categoryId === scope.categoryId)
      );
    case 'day':
      return dayOf(transaction) === scope.day;
  }
}

/** A month's payments in a scope, newest first, under the names the user gave their merchants. */
export function spendingRows(
  scope: SpendingScope,
  month: MonthKey,
  transactions: readonly FinanceTransaction[],
  currency: CurrencyCode,
  aliases: Aliases,
): FinanceTransaction[] {
  return monthSpend(transactions, month, currency)
    .map((transaction) =>
      transaction.merchant
        ? { ...transaction, merchant: merchantName(transaction.merchant, aliases) }
        : transaction,
    )
    .filter((transaction) => isInScope(transaction, scope));
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
): string | null {
  if (scope.kind === 'day') return null;
  const comparison = comparisonFor(month, now);
  const previous = spendingRows(
    scope,
    shiftMonth(month, -1),
    transactions,
    currency,
    aliases,
  ).filter((transaction) => within(transaction, comparison.range));
  return changePhrase(
    totalMinor(spendingRows(scope, month, transactions, currency, aliases)),
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
  if (params.day && parseLocalDateInput(params.day)) {
    return { month: params.day.slice(0, 7), scope: { kind: 'day', day: params.day } };
  }
  return null;
}

export function buildReport(input: ReportInput): Report {
  const { month, now, currency, transactions, aliases } = input;
  const comparison = comparisonFor(month, now);
  const current = monthSpend(transactions, month, currency).map((transaction) =>
    transaction.merchant
      ? { ...transaction, merchant: merchantName(transaction.merchant, aliases) }
      : transaction,
  );
  const previous = monthSpend(transactions, shiftMonth(month, -1), currency).filter((transaction) =>
    within(transaction, comparison.range),
  );

  const categoriesById = new Map(input.categories.map((category) => [category.id, category]));
  const previousByCategory = byCategory(previous);
  const categories = [...byCategory(current)]
    .map(([categoryId, spentMinor]): ReportCategory => {
      const category = categoryId ? categoriesById.get(categoryId) : undefined;
      return {
        categoryId,
        name: category?.name ?? NO_CATEGORY_NAME,
        icon: category?.icon ?? null,
        color: category?.color ?? null,
        spentMinor: spentMinor as MinorAmount,
        previousMinor: (previousByCategory.get(categoryId) ?? 0) as MinorAmount,
      };
    })
    .sort((a, b) => b.spentMinor - a.spentMinor || a.name.localeCompare(b.name));

  const { merchants, count } = topMerchants(current, TOP_MERCHANTS);

  return {
    comparison,
    categories,
    merchants: merchants.map((merchant) => {
      const newest = current.find(
        (transaction) => (transaction.merchant ?? transaction.description) === merchant.name,
      );
      const category = newest?.categoryId ? categoriesById.get(newest.categoryId) : undefined;
      return { ...merchant, icon: category?.icon ?? null, color: category?.color ?? null };
    }),
    merchantCount: count,
  };
}
