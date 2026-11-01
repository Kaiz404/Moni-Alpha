import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { isMonthKey, monthShort, type MonthKey } from '@/lib/finance/budget-month';
import type { FinanceTransaction } from '@/lib/finance/types';

/** What a link from another page narrows Activity to, shown as one clearable chip before the type chips. */
export type ActivityScope =
  | { kind: 'place'; placeId: string; range: string | null }
  | { kind: 'category'; categoryId: string; month: MonthKey | null };

export type ActivityLinkParams = {
  q?: string;
  placeId?: string;
  range?: string;
  categoryId?: string;
  month?: string;
};

export type ActivityLink = {
  query: string;
  scope: ActivityScope | null;
};

/** Every param a link can carry, cleared once the link is read so the same link works again. */
export const CLEARED_LINK: { [K in keyof Required<ActivityLinkParams>]: undefined } = {
  q: undefined,
  placeId: undefined,
  range: undefined,
  categoryId: undefined,
  month: undefined,
};

/** The link in Activity's params, or null when they carry none. */
export function readActivityLink(params: ActivityLinkParams): ActivityLink | null {
  const month = isMonthKey(params.month) ? params.month : null;
  if (!params.q && !params.placeId && !params.categoryId) return null;
  const scope: ActivityScope | null = params.placeId
    ? { kind: 'place', placeId: params.placeId, range: params.range ?? null }
    : params.categoryId
      ? { kind: 'category', categoryId: params.categoryId, month }
      : null;
  return { query: params.q ?? '', scope };
}

/** Whether a row falls in a category scope; a place scope is resolved against the grouped places. */
export function inScope(
  transaction: FinanceTransaction,
  scope: Exclude<ActivityScope, { kind: 'place' }>,
): boolean {
  const day = toLocalDateInput(new Date(transaction.transactionDate));
  return transaction.categoryId === scope.categoryId && (scope.month === null || day.startsWith(`${scope.month}-`));
}

/** The chip's words: "Food & Dining · Oct" for a category month. */
export function scopeLabel(
  scope: Exclude<ActivityScope, { kind: 'place' }>,
  categoryName: string | null,
): string {
  const name = categoryName ?? 'Uncategorized';
  return scope.month ? `${name} · ${monthShort(scope.month)}` : name;
}
