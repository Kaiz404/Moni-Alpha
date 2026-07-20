import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import type { ComponentProps } from 'react';

type TransactionType = 'expense' | 'income' | 'transfer';

export type TransactionIconName = ComponentProps<typeof MaterialDesignIcons>['name'];

/**
 * Resolves persisted category icons, including legacy emoji values, to the
 * Material Design Icons names used by transaction-focused views.
 */
export function resolveTransactionIcon(
  categoryIcon: string | null | undefined,
  type: TransactionType,
): TransactionIconName {
  const legacyIconName = categoryIcon ? LEGACY_CATEGORY_ICON_NAMES[categoryIcon] : undefined;
  if (legacyIconName) return legacyIconName;
  if (categoryIcon && /^[a-z][a-z0-9-]*$/.test(categoryIcon)) {
    return categoryIcon as TransactionIconName;
  }
  if (type === 'income') return 'arrow-down';
  if (type === 'expense') return 'arrow-up';
  return 'swap-horizontal';
}

const LEGACY_CATEGORY_ICON_NAMES: Record<string, TransactionIconName> = {
  '🍔': 'food',
  '🚗': 'car',
  '🏠': 'home',
  '🎬': 'movie-open',
  '🛍️': 'shopping',
  '🏥': 'hospital-building',
  '💼': 'briefcase',
  '🎓': 'school',
  '✈️': 'airplane',
  '📱': 'cellphone',
  '🎁': 'gift',
  '💳': 'credit-card',
  '📦': 'package-variant-closed',
  '💰': 'cash',
  '📈': 'trending-up',
  '💵': 'cash',
};
