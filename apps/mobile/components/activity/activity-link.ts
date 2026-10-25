import { formatDate } from '@/lib/dates/day-label';
import { parseLocalDateInput, toLocalDateInput } from '@/lib/dates/local-date-input';
import { monthShort, type MonthKey } from '@/lib/finance/budget-month';
import type { FinanceTransaction } from '@/lib/finance/types';

/** What a link from another page narrows Activity to, shown as one clearable chip before the type chips. */
export type ActivityScope =
  | { kind: 'place'; placeId: string; range: string | null }
  | { kind: 'category'; categoryId: string; month: MonthKey | null }
  | { kind: 'day'; day: string };

export type ActivityLinkParams = {
  q?: string;
  placeId?: string;
  range?: string;
  day?: string;
  categoryId?: string;
  month?: string;
};

export type ActivityLink = {
  query: string;
  scope: ActivityScope | null;
  /** A day of the chart's month, which the chart selects instead of a chip. */
  chartDay: string | null;
};

/** Every param a link can carry, cleared once the link is read so the same link works again. */
export const CLEARED_LINK: { [K in keyof Required<ActivityLinkParams>]: undefined } = {
  q: undefined,
  placeId: undefined,
  range: undefined,
  day: undefined,
  categoryId: undefined,
  month: undefined,
};

/** The link in Activity's params, or null when they carry none. `chartMonth` is the month the chart draws. */
export function readActivityLink(
  params: ActivityLinkParams,
  chartMonth: MonthKey,
): ActivityLink | null {
  const day = params.day && parseLocalDateInput(params.day) ? params.day : null;
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : null;
  if (!params.q && !params.placeId && !params.categoryId && !day) return null;
  const chartDay = day?.startsWith(`${chartMonth}-`) ? day : null;
  const scope: ActivityScope | null = params.placeId
    ? { kind: 'place', placeId: params.placeId, range: params.range ?? null }
    : params.categoryId
      ? { kind: 'category', categoryId: params.categoryId, month }
      : day && !chartDay
        ? { kind: 'day', day }
        : null;
  return { query: params.q ?? '', scope, chartDay };
}

/** Whether a row falls in a category or day scope; a place scope is resolved against the grouped places. */
export function inScope(
  transaction: FinanceTransaction,
  scope: Exclude<ActivityScope, { kind: 'place' }>,
): boolean {
  const day = toLocalDateInput(new Date(transaction.transactionDate));
  return scope.kind === 'day'
    ? day === scope.day
    : transaction.categoryId === scope.categoryId &&
        (scope.month === null || day.startsWith(`${scope.month}-`));
}

/** The chip's words: "Food & Dining · Oct" for a category month, "Mon 14 Sep" for a day. */
export function scopeLabel(
  scope: Exclude<ActivityScope, { kind: 'place' }>,
  categoryName: string | null,
  now: Date,
): string {
  if (scope.kind === 'day') {
    const date = parseLocalDateInput(scope.day);
    return date ? formatDate(date, now) : scope.day;
  }
  const name = categoryName ?? 'Uncategorized';
  return scope.month ? `${name} · ${monthShort(scope.month)}` : name;
}
