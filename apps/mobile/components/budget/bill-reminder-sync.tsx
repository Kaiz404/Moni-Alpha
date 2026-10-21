import { useEffect, useMemo } from 'react';

import { useBudgetData } from '@/components/budget/use-budget';
import { billReminders, syncBillReminders } from '@/lib/notifications/bill-reminder';

export function BillReminderSync() {
  const { bills, overrides, now } = useBudgetData();
  const wanted = useMemo(() => billReminders(bills, overrides, now), [bills, overrides, now]);
  useEffect(() => {
    syncBillReminders(wanted).catch((error: unknown) => {
      console.warn('[bills] reminders not scheduled', error);
    });
  }, [wanted]);
  return null;
}
