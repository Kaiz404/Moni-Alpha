import type { RecurringOverride, UpcomingBill } from '@repo/types';
import { addMonths, dayKey, dayNumber, nextMonthStart } from '@/lib/ai/facts/days';
import {
  detectRecurring,
  isCashFlow,
  seriesKey,
  type FactsTransaction,
} from '@/lib/ai/facts/recurring';

/** Each series' latest payment, for the wallet it pays from and the category it lands in. */
export function lastPaymentBySeries<T extends FactsTransaction>(
  transactions: readonly T[],
): Map<string, T> {
  const latest = new Map<string, T>();
  for (const tx of transactions) {
    if (!isCashFlow(tx)) continue;
    const key = seriesKey(tx);
    if (!key) continue;
    const current = latest.get(key);
    if (!current || tx.transactionDate > current.transactionDate) latest.set(key, tx);
  }
  return latest;
}

/** Payments that belong to a bill, newest first. */
export function billPayments<T extends FactsTransaction>(
  transactions: readonly T[],
  key: string,
): T[] {
  return transactions
    .filter((tx) => isCashFlow(tx) && seriesKey(tx) === key)
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

/**
 * This month's bills: detected expense series plus confirmed bills the user added, each
 * `due`, `paid` once a payment in the series landed this month, or `skipped` for the month.
 * The user's own name, amount, day, wallet and category win over what detection saw.
 */
export function selectUpcomingBills(
  now: Date,
  transactions: readonly FactsTransaction[],
  overrides: readonly RecurringOverride[],
): UpcomingBill[] {
  const today = dayNumber(now);
  const monthStart = addMonths(today, 0, 1);
  const monthEnd = nextMonthStart(today);
  const period = dayKey(today).slice(0, 7);
  const inMonth = (day: number) => day >= monthStart && day < monthEnd;
  const verdicts = new Map(overrides.map((override) => [override.seriesKey, override]));
  const latest = lastPaymentBySeries(transactions);
  const paidThisMonth = new Set(
    transactions
      .filter((tx) => isCashFlow(tx) && inMonth(dayNumber(tx.transactionDate)))
      .map((tx) => seriesKey(tx)),
  );

  const bill = (
    key: string,
    fallback: Pick<UpcomingBill, 'name' | 'amountMinor' | 'currency' | 'dueDate'>,
    paid: boolean,
  ): UpcomingBill => {
    const override = verdicts.get(key);
    const last = latest.get(key);
    return {
      seriesKey: key,
      name: override?.name ?? fallback.name,
      amountMinor: override?.expectedAmountMinor ?? fallback.amountMinor,
      currency: fallback.currency,
      dueDate: override?.expectedDay
        ? dayKey(addMonths(today, 0, override.expectedDay))
        : fallback.dueDate,
      status: override?.skipPeriod === period ? 'skipped' : paid ? 'paid' : 'due',
      walletId: override?.walletId ?? last?.walletId ?? null,
      categoryId: override?.categoryId ?? last?.categoryId ?? null,
    };
  };

  const bills = new Map<string, UpcomingBill>();
  for (const series of detectRecurring(transactions, overrides, now)) {
    if (series.type !== 'expense') continue;
    const due = inMonth(series.nextExpectedDay);
    if (!due && !inMonth(series.lastDay)) continue;
    bills.set(
      series.key,
      bill(
        series.key,
        {
          name: series.label,
          amountMinor: series.expectedAmountMinor,
          currency: series.currency,
          dueDate: dayKey(due ? series.nextExpectedDay : series.lastDay),
        },
        !due,
      ),
    );
  }

  for (const override of overrides) {
    if (override.status !== 'confirmed' || bills.has(override.seriesKey)) continue;
    if (override.kind !== 'bill' && override.kind !== 'subscription') continue;
    if (!override.expectedDay || !override.expectedAmountMinor) continue;
    if (override.dueOnce && !inMonth(dayNumber(new Date(`${override.dueOnce}T12:00:00`))))
      continue;
    bills.set(override.seriesKey, {
      ...bill(
        override.seriesKey,
        {
          name: override.seriesKey.split('|')[2],
          amountMinor: override.expectedAmountMinor,
          currency: override.currency,
          dueDate: dayKey(addMonths(today, 0, override.expectedDay)),
        },
        paidThisMonth.has(override.seriesKey),
      ),
      ...(override.dueOnce ? { dueDate: override.dueOnce } : {}),
    });
  }

  return [...bills.values()].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name),
  );
}
