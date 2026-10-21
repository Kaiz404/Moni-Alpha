import type { CurrencyCode, MinorAmount } from '@repo/types';

import type { FinanceProposal, FinanceTransaction } from '@/lib/finance/types';
import { resolveTransactionIcon, type TransactionIconName } from '@/lib/transactions/icon';

type RowBase = {
  title: string;
  date: string;
  amountMinor: MinorAmount;
  currency: CurrencyCode;
  icon: TransactionIconName;
  /** The category's own colour; rows never pick a colour of their own. */
  color: string | null;
};

/** What one transaction row shows. A pending capture is not in totals and carries no sign. */
export type TransactionRowData = RowBase &
  (
    | {
        kind: 'expense' | 'income';
        category: string | null;
        wallet: string;
        autoAdded: boolean;
      }
    | { kind: 'transfer'; wallet: string; toWallet: string; autoAdded: boolean }
    | { kind: 'pending'; category: string | null; wallet: string | null }
  );

export type RowLookups = {
  categoriesById: Record<string, { name: string; icon: string | null; color: string | null }>;
  walletNames: Record<string, string>;
};

export function transactionRow(
  transaction: FinanceTransaction,
  { categoriesById, walletNames }: RowLookups,
): TransactionRowData {
  const category = transaction.categoryId ? categoriesById[transaction.categoryId] : undefined;
  const wallet = walletNames[transaction.walletId] ?? 'Wallet';
  const base: RowBase = {
    title: transaction.merchant ?? transaction.description ?? category?.name ?? 'Transaction',
    date: transaction.transactionDate,
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    icon: resolveTransactionIcon(category?.icon, transaction.type),
    color: category?.color ?? null,
  };
  if (transaction.type === 'transfer') {
    const toWallet = walletNames[transaction.transferToWalletId ?? ''] ?? 'Wallet';
    return {
      ...base,
      title: transaction.description ?? 'Transfer',
      kind: 'transfer',
      wallet,
      toWallet,
      autoAdded: transaction.autoAdded,
    };
  }
  return {
    ...base,
    kind: transaction.type,
    category: category?.name ?? null,
    wallet,
    autoAdded: transaction.autoAdded,
  };
}

export function proposalRow(
  proposal: FinanceProposal,
  { categoriesById, walletNames }: RowLookups,
): TransactionRowData {
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
