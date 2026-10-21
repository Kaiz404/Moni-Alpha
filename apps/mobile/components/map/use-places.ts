import { syncState } from '@legendapp/state';
import { useSelector, useValue } from '@legendapp/state/react';
import { useMemo } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { useMainCurrency } from '@/lib/finance/main-currency';
import type { Place } from '@/lib/finance/places';
import {
  categoriesForUser$,
  transactions$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import { transactions$ as transactionTable$ } from '@/lib/store';
import {
  resolveTransactionIcon,
  type TransactionIconName,
} from '@/lib/transactions/icon';
import type { RowLookups } from '@/lib/transactions/row';

export type CategoryLook = {
  name: string;
  icon: TransactionIconName;
  color: string | null;
};

const UNCATEGORISED: CategoryLook = {
  name: 'No category',
  icon: 'map-marker-outline',
  color: null,
};

/** The ledger rows, lookups, and main currency every map screen reads. */
export function usePlaceSources() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const currency = useMainCurrency();
  const transactions = useValue(transactions$({ userId }));
  const categories = useValue(categoriesForUser$(userId));
  const wallets = useValue(walletsForUser$(userId));
  const loaded = useSelector(
    () => syncState(transactionTable$).get().isPersistLoaded,
  );

  const lookups = useMemo<RowLookups>(
    () => ({
      categoriesById: Object.fromEntries(
        categories.map((category) => [category.id, category]),
      ),
      walletNames: Object.fromEntries(
        wallets.map((wallet) => [wallet.id, wallet.name]),
      ),
    }),
    [categories, wallets],
  );

  const categoryLook = (categoryId: string | null): CategoryLook => {
    const category = categoryId
      ? lookups.categoriesById[categoryId]
      : undefined;
    return category
      ? {
          name: category.name,
          icon: resolveTransactionIcon(category.icon, 'expense'),
          color: category.color,
        }
      : UNCATEGORISED;
  };

  return {
    userId,
    currency,
    transactions,
    lookups,
    loaded,
    categoryLook,
  };
}

/** "Groceries, Food & Dining +2": the two biggest categories at a place. */
export function placeCategoryLine(
  place: Place,
  look: (categoryId: string | null) => CategoryLook,
): string {
  const names = place.categories
    .slice(0, 2)
    .map((category) => look(category.categoryId).name);
  const more = place.categories.length - 2;
  return `${names.join(', ')}${more > 0 ? ` +${more}` : ''}`;
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
