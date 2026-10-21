import type { RecurringOverride, UpcomingBill } from '@repo/types';
import { addMonths, dayKey, dayNumber, nextMonthStart } from '@/lib/ai/facts/days';
import { detectRecurring, seriesKey, type FactsTransaction } from '@/lib/ai/facts/recurring';

export function selectUpcomingBills(
  now: Date,
  transactions: readonly FactsTransaction[],
  overrides: readonly RecurringOverride[],
): UpcomingBill[] {
  const today = dayNumber(now);
  const monthStart = addMonths(today, 0, 1);
  const monthEnd = nextMonthStart(today);
  const inMonth = (day: number) => day >= monthStart && day < monthEnd;

  const bills = new Map<string, UpcomingBill>();
  for (const series of detectRecurring(transactions, overrides, now)) {
    if (series.type !== 'expense') continue;
    const due = inMonth(series.nextExpectedDay);
    if (!due && !inMonth(series.lastDay)) continue;
    bills.set(series.key, {
      seriesKey: series.key,
      name: series.label,
      amountMinor: series.expectedAmountMinor,
      currency: series.currency,
      dueDate: dayKey(due ? series.nextExpectedDay : series.lastDay),
      status: due ? 'due' : 'paid',
    });
  }

  const paidThisMonth = new Set(
    transactions.filter((tx) => inMonth(dayNumber(tx.transactionDate))).map((tx) => seriesKey(tx)),
  );
  for (const override of overrides) {
    if (override.status !== 'confirmed' || bills.has(override.seriesKey)) continue;
    if (override.kind !== 'bill' && override.kind !== 'subscription') continue;
    if (!override.expectedDay || !override.expectedAmountMinor) continue;
    bills.set(override.seriesKey, {
      seriesKey: override.seriesKey,
      name: override.seriesKey.split('|')[2],
      amountMinor: override.expectedAmountMinor,
      currency: override.currency,
      dueDate: dayKey(addMonths(today, 0, override.expectedDay)),
      status: paidThisMonth.has(override.seriesKey) ? 'paid' : 'due',
    });
  }

  return [...bills.values()].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name),
  );
}
