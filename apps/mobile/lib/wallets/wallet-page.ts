import { minorToNumber, type MinorAmount } from '@repo/types';

import { formatMoney, formatSignedMoney } from '@/lib/finance/format-money';
import { correctBalance } from '@/lib/wallets/balance-correction';

const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Checked today", "Last checked 40 days ago": when the user last saw this balance and said it was right. */
export function checkedLabel(confirmedAt: string | null, now: Date = new Date()): string {
  const at = confirmedAt ? new Date(confirmedAt) : null;
  if (!at || Number.isNaN(at.getTime())) return 'Never checked';
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(at)) / DAY_MS));
  if (days === 0) return 'Checked today';
  if (days === 1) return 'Last checked yesterday';
  return `Last checked ${days} days ago`;
}

/** Where the real balance comes from: the linked app, or counting cash. */
export type BalanceSource = { kind: 'app'; name: string } | { kind: 'cash' };

/** The status line under the balance field while the user types the real balance. */
export function balanceDiffLine(
  balanceMinor: MinorAmount,
  currency: string,
  typed: number | null,
  source: BalanceSource,
): string {
  const ask =
    source.kind === 'cash'
      ? 'Type the cash you have.'
      : `Type the balance your ${source.name} app shows.`;
  if (typed === null) return ask;
  const correction = correctBalance({ balance: minorToNumber(balanceMinor) }, typed);
  if (!correction) {
    const what = source.kind === 'cash' ? 'you count' : `your ${source.name} app shows`;
    return `Moni has ${formatMoney(balanceMinor, currency)}. Type what ${what}.`;
  }
  return `Moni adds a ${formatSignedMoney(correction.type, correction.amountMinor, currency)} balance correction. Not counted as spending or income.`;
}
