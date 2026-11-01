import type { TransactionType } from '@repo/types';

export const TRANSACTION_TYPES: readonly TransactionType[] = ['expense', 'income', 'transfer'];

/** What the Type tile and the Type sheet say about each type. */
export const TRANSACTION_TYPE_COPY: Record<TransactionType, { label: string; meta: string }> = {
  expense: { label: 'Expense', meta: 'Counts as spending' },
  income: { label: 'Income', meta: 'Counts as money in' },
  transfer: { label: 'Transfer', meta: 'Moves between your wallets' },
};

/** A category belongs to one type, so a row that changes type gives up its category. */
export function retypeFields(type: TransactionType): {
  type: TransactionType;
  categoryId: null;
} {
  return { type, categoryId: null };
}
