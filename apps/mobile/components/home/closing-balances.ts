import type { ChartMonth } from '@/components/charts/pace-geometry';
import { transactionDeltaMinor } from '@/lib/finance/ledger';
import type { FinanceTransaction } from '@/lib/finance/types';

/**
 * Closing balance of `walletIds` together for each day of this month so far,
 * walked back from today's balance. Index 0 is day 1, the last is today.
 */
export function closingBalances({
  now,
  walletIds,
  balanceMinor,
  transactions,
}: {
  now: Date;
  walletIds: ReadonlySet<string>;
  balanceMinor: number;
  transactions: readonly FinanceTransaction[];
}): { month: ChartMonth; values: number[] } {
  const month = { year: now.getFullYear(), month: now.getMonth() };
  const today = now.getDate();
  /** Change on each day of the month, and after today. */
  const change = Array.from({ length: today + 1 }, () => 0);
  const monthStart = new Date(month.year, month.month, 1).getTime();
  for (const transaction of transactions) {
    const when = new Date(transaction.transactionDate);
    if (when.getTime() < monthStart) continue;
    let delta = 0;
    for (const walletId of walletIds) delta += Number(transactionDeltaMinor(transaction, walletId));
    if (!delta) continue;
    const sameMonth = when.getFullYear() === month.year && when.getMonth() === month.month;
    const day = sameMonth ? Math.min(when.getDate(), today + 1) : today + 1;
    change[day - 1]! += delta;
  }
  const values = Array.from({ length: today }, () => 0);
  let closing = balanceMinor - change[today]!;
  for (let day = today; day >= 1; day--) {
    values[day - 1] = closing;
    closing -= change[day - 1]!;
  }
  return { month, values };
}
