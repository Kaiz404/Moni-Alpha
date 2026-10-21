import type { RecurringOverride, UpcomingBill } from '@repo/types';
import * as Notifications from 'expo-notifications';

import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import { formatMoney } from '@/lib/finance/format-money';

export const REMINDER_HOUR = 9;

/** 9:00 am local on the day before a `YYYY-MM-DD` due date. */
export function reminderAt(dueDate: string): Date | null {
  const due = parseLocalDateInput(dueDate);
  return due ? new Date(due.getFullYear(), due.getMonth(), due.getDate() - 1, REMINDER_HOUR) : null;
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

export const BILL_REMINDER_CHANNEL = 'bill-reminders';
const ID_PREFIX = 'bill:';

/** A bill reminder the phone already holds; `at` is what was scheduled, read from its data. */
export type ScheduledBillReminder = { id: string; at: string | null; title: string; body: string };

/** What to cancel and what to (re)schedule so the phone holds exactly `wanted`. */
export function billReminderChanges(
  wanted: readonly BillReminder[],
  scheduled: readonly ScheduledBillReminder[],
): { cancel: string[]; schedule: BillReminder[] } {
  const held = new Map(
    scheduled.filter((item) => item.id.startsWith(ID_PREFIX)).map((item) => [item.id, item]),
  );
  const same = (reminder: BillReminder) => {
    const item = held.get(reminder.id);
    return (
      item !== undefined &&
      item.at === reminder.at.toISOString() &&
      item.title === reminder.title &&
      item.body === reminder.body
    );
  };
  const kept = new Set(wanted.filter(same).map((reminder) => reminder.id));
  return {
    cancel: [...held.keys()].filter((id) => !kept.has(id)),
    schedule: wanted.filter((reminder) => !kept.has(reminder.id)),
  };
}

let syncing: Promise<void> = Promise.resolve();

/**
 * Makes the scheduled bill reminders match `wanted`. Running it again with the same list
 * changes nothing, and an empty list cancels them all (Remind off, Stop tracking, sign out).
 */
export function syncBillReminders(wanted: readonly BillReminder[]): Promise<void> {
  syncing = syncing
    .catch(() => {})
    .then(async () => {
      await Notifications.setNotificationChannelAsync(BILL_REMINDER_CHANNEL, {
        name: 'Bill reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).map(
        (request) => ({
          id: request.identifier,
          at: typeof request.content.data?.at === 'string' ? request.content.data.at : null,
          title: request.content.title ?? '',
          body: request.content.body ?? '',
        }),
      );
      const { cancel, schedule } = billReminderChanges(wanted, scheduled);
      for (const id of cancel) await Notifications.cancelScheduledNotificationAsync(id);
      for (const reminder of schedule)
        await Notifications.scheduleNotificationAsync({
          identifier: reminder.id,
          content: {
            title: reminder.title,
            body: reminder.body,
            data: { kind: 'bill', at: reminder.at.toISOString() },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminder.at,
            channelId: BILL_REMINDER_CHANNEL,
          },
        });
    });
  return syncing;
}

/** Android 13+ needs POST_NOTIFICATIONS before a reminder can show. Asked when Remind turns on. */
export async function ensureBillReminderPermission(): Promise<void> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return;
  await Notifications.requestPermissionsAsync();
}
