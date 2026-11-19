import type { CurrencyCode, MinorAmount } from '@repo/types';

import { BALANCE_CORRECTION_TITLE } from '../write-plans/balance-correction';
import type { FinanceTransaction } from './types';

const ACCOUNT_KIND = /[\s\-–—·:,]+(?:savings?|current|account|acct|e[\s-]?wallet|wallet)$/i;
/** tokens.md Lemon: the balance correction bubble on every list. */
const LEMON = '#F7CF3A';

/** "Maybank Savings Account" reads "Maybank"; a name that is only a kind, like "Savings", stays. */
export function compactWalletName(name: string): string {
  let compact = name.trim();
  for (;;) {
    const next = compact.replace(ACCOUNT_KIND, '');
    if (next === compact || !next) return compact;
    compact = next;
  }
}

/** Wallet id to the name rows and chips show; two wallets that would read the same keep their full names. */
export function compactWalletNames(wallets: readonly { id: string; name: string }[]): Record<string, string> {
  const readers = new Map<string, number>();
  const key = (name: string) => compactWalletName(name).toLowerCase();
  for (const wallet of wallets) readers.set(key(wallet.name), (readers.get(key(wallet.name)) ?? 0) + 1);
  return Object.fromEntries(
    wallets.map((wallet) => [wallet.id, readers.get(key(wallet.name)) === 1 ? compactWalletName(wallet.name) : wallet.name]),
  );
}

/** The category glyph by its MDI name, or the type's arrow when the category has none. */
export function transactionIcon(categoryIcon: string | null | undefined, type: FinanceTransaction['type']): string {
  if (categoryIcon && /^[a-z][a-z0-9-]*$/.test(categoryIcon)) return categoryIcon;
  return type === 'income' ? 'arrow-down' : type === 'expense' ? 'arrow-up' : 'swap-horizontal';
}

export type RowLookups = {
  categoriesById: Record<string, { name: string; icon: string | null; color: string | null }>;
  walletNames: Record<string, string>;
};

/** What a transaction row shows, as the phone's rows show it (tokens.md Lists and rows). */
export type TransactionRow = {
  id: string;
  title: string;
  date: string;
  amountMinor: MinorAmount;
  currency: CurrencyCode;
  icon: string;
  /** The bubble's solid colour; null for a transfer's Sand bubble. */
  color: string | null;
  /** The category's name, "Not in budgets" for a balance correction, null for a transfer or none. */
  category: string | null;
  wallet: string;
  autoAdded: boolean;
} & ({ kind: 'expense' | 'income'; toWallet: null } | { kind: 'transfer'; toWallet: string });

export function transactionRow(transaction: FinanceTransaction, { categoriesById, walletNames }: RowLookups): TransactionRow {
  const category = transaction.categoryId ? categoriesById[transaction.categoryId] : undefined;
  const base = {
    id: transaction.id,
    title: transaction.merchant ?? transaction.description ?? category?.name ?? 'Transaction',
    date: transaction.transactionDate,
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    icon: transactionIcon(category?.icon, transaction.type),
    color: category?.color ?? null,
    category: category?.name ?? null,
    wallet: walletNames[transaction.walletId] ?? 'Wallet',
    autoAdded: transaction.autoAdded,
  };
  if (transaction.type === 'transfer')
    return {
      ...base,
      kind: 'transfer',
      title: transaction.description ?? 'Transfer',
      color: null,
      category: null,
      toWallet: walletNames[transaction.transferToWalletId ?? ''] ?? 'Wallet',
    };
  if (transaction.balanceCorrection)
    return {
      ...base,
      kind: transaction.type,
      toWallet: null,
      title: BALANCE_CORRECTION_TITLE,
      icon: 'scale-balance',
      color: LEMON,
      category: 'Not in budgets',
      autoAdded: false,
    };
  return { ...base, kind: transaction.type, toWallet: null };
}
