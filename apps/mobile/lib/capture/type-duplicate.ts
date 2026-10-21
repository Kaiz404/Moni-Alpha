import type { MinorAmount } from '@repo/types';

import { findDuplicate, type LedgerEntry } from '@/lib/ai/duplicates';
import { formatDay } from '@/lib/dates/day-label';
import { formatMoney } from '@/lib/finance/format-money';

/** A typed expense this long after a saved or waiting one with the same amount reads as the same purchase. */
const TYPED_DUPLICATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The saved row or waiting capture a typed entry repeats, if any. With no shop
 * typed, only the same wallet counts, so a bare RM12 does not match every RM12.
 */
export function findTypedDuplicate(
  draft: LedgerEntry,
  existing: readonly LedgerEntry[],
): LedgerEntry | null {
  const pool = draft.merchant
    ? existing
    : existing.filter((entry) => entry.walletId === draft.walletId);
  const match = findDuplicate(draft, pool, {
    samePurchaseWindowMs: TYPED_DUPLICATE_WINDOW_MS,
  });
  return match?.kind === 'same_purchase' ? match.target : null;
}

function clock(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

export type DuplicateCopy = { title: string; message: string };

/** The duplicate sheet's title and sentence, as V2A-CaptureTypeDuplicate words them. */
export function duplicateCopy(
  target: {
    kind: LedgerEntry['kind'];
    amountMinor: MinorAmount;
    currency: string;
    merchant: string | null;
    at: string;
    walletName: string | null;
    fromNotification: boolean;
  },
  now: Date = new Date(),
): DuplicateCopy {
  const at = new Date(target.at);
  const what = [
    formatMoney(target.amountMinor, target.currency),
    target.merchant ? `at ${target.merchant}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const day = formatDay(at, now);
  const when =
    day === 'Today'
      ? `at ${clock(at)}`
      : `${day === 'Yesterday' ? 'yesterday' : `on ${day}`} at ${clock(at)}`;
  const twice = 'Adding this too would count it twice.';
  if (target.kind === 'proposal') {
    const from =
      target.fromNotification && target.walletName
        ? `from your ${target.walletName} notification`
        : null;
    return {
      title: 'Already in Review',
      message: `Moni caught ${[what, from, when].filter(Boolean).join(' ')}. ${twice}`,
    };
  }
  return {
    title: 'Already added',
    message: `You added ${what} ${when}. ${twice}`,
  };
}
