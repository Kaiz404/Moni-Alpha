import type { CurrencyCode, MinorAmount } from '@repo/types';

import type { FinanceProposal, RowLookups, TransactionRow } from '@repo/core';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

/** A capture still waiting in Review, shown among saved rows. */
export type PendingRowData = {
  kind: 'pending';
  title: string;
  date: string;
  amountMinor: MinorAmount;
  currency: CurrencyCode;
  icon: string;
  color: string | null;
  category: string | null;
  wallet: string | null;
};

export type TransactionRowData = TransactionRow | PendingRowData;

export function proposalRow(
  proposal: FinanceProposal,
  { categoriesById, walletNames }: RowLookups,
): PendingRowData {
  const category = proposal.categoryId ? categoriesById[proposal.categoryId] : undefined;
  return {
    kind: 'pending',
    title: proposal.merchant ?? proposal.description ?? category?.name ?? 'Capture',
    date: proposal.transactionDate ?? proposal.createdAt,
    amountMinor: proposal.amountMinor ?? (0 as MinorAmount),
    currency: proposal.currency,
    icon: resolveTransactionIcon(category?.icon, proposal.type ?? 'expense'),
    color: category?.color ?? null,
    category: category?.name ?? null,
    wallet: proposal.walletId ? (walletNames[proposal.walletId] ?? null) : null,
  };
}
