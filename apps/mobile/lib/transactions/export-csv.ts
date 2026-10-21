import { minorToDecimal } from '@repo/types';

import type { FinanceTransaction } from '@/lib/finance/types';
import { toLocalDateInput } from '@/lib/dates/local-date-input';

const HEADER = ['Date', 'Type', 'Amount', 'Currency', 'Merchant', 'Category', 'Wallet', 'To wallet', 'Note'];

function cell(value: string | null | undefined): string {
  const text = value ?? '';
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One row per transaction, oldest first. Amounts are unsigned decimals in the
 * transaction's own currency; Type says which way the money moved.
 */
export function transactionsCsv(
  transactions: readonly FinanceTransaction[],
  walletNames: Readonly<Record<string, string>>,
  categoryNames: Readonly<Record<string, string>>,
): string {
  const rows = [...transactions]
    .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate))
    .map((t) =>
      [
        toLocalDateInput(new Date(t.transactionDate)),
        t.type,
        minorToDecimal(Math.abs(t.amountMinor)),
        t.currency,
        t.merchant ?? t.description,
        t.categoryId ? categoryNames[t.categoryId] : null,
        walletNames[t.walletId],
        t.transferToWalletId ? walletNames[t.transferToWalletId] : null,
        t.notes,
      ]
        .map(cell)
        .join(','),
    );
  return [HEADER.join(','), ...rows].join('\n') + '\n';
}

/** `moni-2026-10-14.csv` for the day it is saved. */
export function exportFileName(now: Date): string {
  return `moni-${toLocalDateInput(now)}.csv`;
}
