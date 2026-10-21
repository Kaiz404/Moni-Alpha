import type { RecurringOverride, UpcomingBill } from '@repo/types';

import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import { formatMoney } from '@/lib/finance/format-money';

export const REMINDER_HOUR = 9;

/** 9:00 am local on the day before a `YYYY-MM-DD` due date. */
export function reminderAt(dueDate: string): Date | null {
  const due = parseLocalDateInput(dueDate);
  return due
    ? new Date(due.getFullYear(), due.getMonth(), due.getDate() - 1, REMINDER_HOUR)
    : null;
}

export type BillReminder = {
  /** One reminder per bill, so rescheduling replaces it. */
  id: string;
  at: Date;
  title: string;
  body: string;
};

/** The reminders to have scheduled: bills still due with Remind on, whose time has not passed. */
export function billReminders(
  bills: readonly UpcomingBill[],
  overrides: readonly RecurringOverride[],
  now: Date,
): BillReminder[] {
  const remind = new Set(
    overrides.filter((override) => override.remind).map((override) => override.seriesKey),
  );
  return bills.flatMap((bill) => {
    const at = reminderAt(bill.dueDate);
    if (bill.status !== 'due' || !remind.has(bill.seriesKey) || !at || at <= now) return [];
    return [
      {
        id: `bill:${bill.seriesKey}`,
        at,
        title: `${bill.name} is due tomorrow`,
        body: formatMoney(bill.amountMinor, bill.currency),
      },
    ];
  });
}
