import { useSyncExternalStore } from 'react';
import { Share } from 'react-native';

import { formatDate } from '@/lib/dates/day-label';
import { parseLocalDateInput, toLocalDateInput } from '@/lib/dates/local-date-input';
import type { DebtLine } from '@/lib/finance/debt-summary';
import { formatMoney } from '@/lib/finance/format-money';
import { preferencesMMKV } from '@/lib/mmkv/preferences';

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
  const today = toLocalDateInput(new Date());
  return (debtId) => preferencesMMKV.getString(KEY + debtId) === today;
}

export function reminderMessage(line: DebtLine, now = new Date()): string {
  const { counterpartyName: name, note, dueDate, currency } = line.debt;
  const amount = formatMoney(line.balanceMinor, currency);
  const what = note ? `the ${amount} for ${note}` : `the ${amount} you owe me`;
  const due = dueDate ? parseLocalDateInput(dueDate) : null;
  return `Hi ${name}, a reminder about ${what}${due ? `, due ${formatDate(due, now)}` : ''}. Thanks!`;
}

/** D5: Moni can't send messages, so Remind hands a prefilled one to the Android share sheet. */
export async function sendReminder(line: DebtLine): Promise<void> {
  const result = await Share.share({ message: reminderMessage(line) });
  // Android resolves sharedAction even when the sheet is closed, so a
  // cancelled share there still counts as reminded today.
  if (result.action === Share.dismissedAction) return;
  preferencesMMKV.set(KEY + line.debt.id, toLocalDateInput(new Date()));
  version += 1;
  listeners.forEach((listener) => listener());
}
