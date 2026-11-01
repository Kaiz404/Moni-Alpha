import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { transactionDeltaMinor } from '@/lib/finance/ledger';
import type { FinanceTransaction } from '@/lib/finance/types';

export type BalanceRange = 'month' | '30d' | '90d' | '1y';

export const BALANCE_RANGES: readonly { value: BalanceRange; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
];

/** Closing balances, one entry per local day, oldest first. The last day is today. */
export type BalanceHistory = {
  /** Local `YYYY-MM-DD`. Starts at the range start, or the day the first wallet began if later. */
  days: string[];
  total: number[];
  /** Null before the wallet began, so no line is drawn for days it did not exist. */
  byWallet: Record<string, (number | null)[]>;
};

function rangeStart(now: Date, range: BalanceRange): string {
  const [year, month, day] = [now.getFullYear(), now.getMonth(), now.getDate()];
  switch (range) {
    case 'month':
      return toLocalDateInput(new Date(year, month, 1));
    case '30d':
      return toLocalDateInput(new Date(year, month, day - 29));
    case '90d':
      return toLocalDateInput(new Date(year, month, day - 89));
    case '1y':
      return toLocalDateInput(new Date(year - 1, month, day));
  }
}

/**
 * Walks each wallet back from today's balance. A wallet begins on the day it was created, or on
 * its first transaction when one is backdated earlier. Transactions dated after today are in the
 * live balance but stay out of today's closing value.
 */
export function balanceHistory({
  now,
  range,
  wallets,
  transactions,
}: {
  now: Date;
  range: BalanceRange;
  wallets: readonly { id: string; balanceMinor: number; createdAt?: string | null }[];
  transactions: readonly Pick<
    FinanceTransaction,
    'walletId' | 'transferToWalletId' | 'amountMinor' | 'type' | 'transactionDate'
  >[];
}): BalanceHistory {
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

  const start = rangeStart(now, range);
  const earliest = [...began.values()].reduce((a, b) => (b < a ? b : a), today);
  const first = earliest > start ? earliest : start;
  const days: string[] = [];
  const [year, month, date] = [now.getFullYear(), now.getMonth(), now.getDate()];
  // Calendar arithmetic, not 24-hour steps, so a daylight saving change cannot skip or repeat a day.
  for (let back = 0; ; back++) {
    const day = toLocalDateInput(new Date(year, month, date - back));
    if (day < first) break;
    days.unshift(day);
  }

  const total = days.map(() => 0);
  const byWallet: BalanceHistory['byWallet'] = {};
  for (const wallet of wallets) {
    const change = changes.get(wallet.id)!;
    const begin = began.get(wallet.id)!;
    const values = days.map<number | null>(() => null);
    let closing = wallet.balanceMinor - afterToday.get(wallet.id)!;
    for (let index = days.length - 1; index >= 0 && days[index]! >= begin; index--) {
      values[index] = closing;
      total[index]! += closing;
      closing -= change.get(days[index]!) ?? 0;
    }
    byWallet[wallet.id] = values;
  }
  return { days, total, byWallet };
}
