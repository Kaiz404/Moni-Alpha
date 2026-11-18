import { useSyncExternalStore } from 'react';
import { Share } from 'react-native';

import { preferencesMMKV } from '@/lib/mmkv/preferences';
import { type DebtLine, dateLabel, formatMoney, parseDayKey } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

const KEY = 'debt-reminded:';
let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether a debt's reminder went out today, kept on this phone only. */
export function useRemindedToday(): (debtId: string) => boolean {
  useSyncExternalStore(subscribe, () => version);
  const today = deviceCalendar.dayKey(new Date());
  return (debtId) => preferencesMMKV.getString(KEY + debtId) === today;
}

export function reminderMessage(line: DebtLine, now = new Date()): string {
  const { counterpartyName: name, note, dueDate, currency } = line.debt;
  const amount = formatMoney(line.balanceMinor, currency);
  const what = note ? `the ${amount} for ${note}` : `the ${amount} you owe me`;
  const due = dueDate ? parseDayKey(dueDate) : null;
  return `Hi ${name}, a reminder about ${what}${due ? `, due ${dateLabel(due, deviceCalendar.dayKey(now))}` : ''}. Thanks!`;
}

/** D5: Moni can't send messages, so Remind hands a prefilled one to the Android share sheet. */
export async function sendReminder(line: DebtLine): Promise<void> {
  const result = await Share.share({ message: reminderMessage(line) });
  // Android resolves sharedAction even when the sheet is closed, so a
  // cancelled share there still counts as reminded today.
  if (result.action === Share.dismissedAction) return;
  preferencesMMKV.set(KEY + line.debt.id, deviceCalendar.dayKey(new Date()));
  version += 1;
  listeners.forEach((listener) => listener());
}
