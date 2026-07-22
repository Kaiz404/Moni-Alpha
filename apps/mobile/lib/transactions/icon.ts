import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import type { ComponentProps } from 'react';

type TransactionType = 'expense' | 'income' | 'transfer';

export type TransactionIconName = ComponentProps<typeof MaterialDesignIcons>['name'];

/** Resolves curated Material Design category icon names for transaction rows. */
export function resolveTransactionIcon(
  categoryIcon: string | null | undefined,
  type: TransactionType,
): TransactionIconName {
  if (categoryIcon && /^[a-z][a-z0-9-]*$/.test(categoryIcon)) {
    return categoryIcon as TransactionIconName;
  }
  if (type === 'income') return 'arrow-down';
  if (type === 'expense') return 'arrow-up';
  return 'swap-horizontal';
}
