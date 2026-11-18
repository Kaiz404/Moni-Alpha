import { useEffect, useMemo } from 'react';

import { useBudgetData } from '@/components/budget/use-budget';
import { selectBillsAhead } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';
import { billReminders, syncBillReminders } from '@/lib/notifications/bill-reminder';

export function BillReminderSync() {
  const { transactions, overrides, now } = useBudgetData();
  const wanted = useMemo(
    () => billReminders(selectBillsAhead(now, transactions, overrides, deviceCalendar), overrides, now),
    [transactions, overrides, now],
  );
  useEffect(() => {
    syncBillReminders(wanted).catch((error: unknown) => {
      console.warn('[bills] reminders not scheduled', error);
    });
  }, [wanted]);
  return null;
}
