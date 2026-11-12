import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { dayNumber, rangeStartIndex, type ChartRange } from '@/lib/finance/chart-range';
import { transactionDeltaMinor } from '@/lib/finance/ledger';
import type { FinanceTransaction } from '@/lib/finance/types';

/**
 * Closing balances, one entry per local day from the day the first wallet began to today, built
 * once per change of the wallets, balances or transactions and sliced by every chart range.
 */
export type BalanceIndex = {
  /** Local `YYYY-MM-DD` of day 0. */
  firstDay: string;
  /** Days in the index; the last one, `days - 1`, is today. */
  days: number;
  total: Float64Array;
  /** NaN before the wallet began, so no line is drawn for days it did not exist. */
  byWallet: Record<string, Float64Array>;
  /** 1 on each day a transaction moved a wallet's balance. */
  changed: Uint8Array;
};

/**
 * Walks each wallet back from today's balance. A wallet begins on the day it was created, or on
 * its first transaction when one is backdated earlier. Transactions dated after today are in the
 * live balance but stay out of today's closing value.
 */
export function balanceIndex({
  now,
  wallets,
  transactions,
}: {
  now: Date;
  wallets: readonly { id: string; balanceMinor: number; createdAt?: string | null }[];
  transactions: readonly Pick<
    FinanceTransaction,
    'walletId' | 'transferToWalletId' | 'amountMinor' | 'type' | 'transactionDate'
  >[];
}): BalanceIndex {
  const today = toLocalDateInput(now);
  const began = new Map(
    wallets.map((wallet) => {
      const created = wallet.createdAt ? toLocalDateInput(new Date(wallet.createdAt)) : today;
      return [wallet.id, created < today ? created : today];
    }),
  );
  const changes = new Map(wallets.map((wallet) => [wallet.id, new Map<string, number>()]));
  const afterToday = new Map(wallets.map((wallet) => [wallet.id, 0]));
  for (const transaction of transactions) {
    const day = toLocalDateInput(new Date(transaction.transactionDate));
    for (const id of [transaction.walletId, transaction.transferToWalletId]) {
      const change = id ? changes.get(id) : undefined;
      if (!id || !change) continue;
      const delta = Number(transactionDeltaMinor(transaction, id));
      if (day > today) {
        afterToday.set(id, afterToday.get(id)! + delta);
        continue;
      }
      change.set(day, (change.get(day) ?? 0) + delta);
      if (day < began.get(id)!) began.set(id, day);
    }
  }

  const firstDay = [...began.values()].reduce((a, b) => (b < a ? b : a), today);
  const origin = dayNumber(firstDay);
  const days = dayNumber(today) - origin + 1;
  const total = new Float64Array(days);
  const changed = new Uint8Array(days);
  const byWallet: BalanceIndex['byWallet'] = {};
  for (const wallet of wallets) {
    const values = new Float64Array(days).fill(NaN);
    const byDay = new Float64Array(days);
    for (const [day, delta] of changes.get(wallet.id)!) {
      byDay[dayNumber(day) - origin] = delta;
      changed[dayNumber(day) - origin] = 1;
    }
    const begin = dayNumber(began.get(wallet.id)!) - origin;
    let closing = wallet.balanceMinor - afterToday.get(wallet.id)!;
    for (let day = days - 1; day >= begin; day--) {
      values[day] = closing;
      total[day]! += closing;
      closing -= byDay[day]!;
    }
    byWallet[wallet.id] = values;
  }
  return { firstDay, days, total, byWallet, changed };
}

/**
 * The days a range shows, both ends included: its start to today. A wallet with no history yet
 * shortens the range rather than drawing a line before it existed.
 */
export function balanceViewport(
  index: BalanceIndex,
  now: Date,
  range: ChartRange,
): { from: number; to: number } {
  return {
    from: Math.max(0, rangeStartIndex(index.firstDay, now, range) ?? 0),
    to: index.days - 1,
  };
}
