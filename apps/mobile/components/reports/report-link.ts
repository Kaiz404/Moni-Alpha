import { NO_CATEGORY, type ActivityLinkParams } from '@/components/activity/activity-link';

import type { ReportCategory, ReportRange } from '@/lib/reports/report';

/**
 * Activity's filter for a report's category row. Its month param holds one month, so a period
 * across months opens the category's whole history.
 */
export function categoryLink(
  categoryId: ReportCategory['categoryId'],
  range: ReportRange,
): ActivityLinkParams {
  const month = range.from.slice(0, 7);
  return {
    categoryId: categoryId ?? NO_CATEGORY,
    ...(month === range.to.slice(0, 7) ? { month } : {}),
  };
}

export function merchantLink(name: string): ActivityLinkParams {
  return { q: name };
}
