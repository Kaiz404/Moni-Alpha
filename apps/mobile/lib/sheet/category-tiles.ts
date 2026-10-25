import type { MinorAmount } from '@repo/types';

import type { BudgetProgress } from '@/lib/finance/selectors';
import type { CategoryTile } from '@/lib/sheet/sheet-store';

type CategoryLike = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  userId: string | null;
};

/** Joins categories with this month's spend and budget in one currency, recent ids first. */
export function toCategoryTiles(
  categories: CategoryLike[],
  progress: BudgetProgress[],
  currency: string,
  recentIds: string[] = [],
): CategoryTile[] {
  const byCategory = new Map(
    progress
      .filter((row) => row.currency === currency.toUpperCase())
      .map((row) => [row.categoryId, row]),
  );
  const rank = (id: string) => {
    const index = recentIds.indexOf(id);
    return index === -1 ? recentIds.length : index;
  };
  return [...categories]
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map((category) => {
      const row = byCategory.get(category.id);
      return {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        custom: category.userId !== null,
        spentMinor: row?.spentMinor ?? (0 as MinorAmount),
        budgetMinor: row?.budgetAmountMinor ?? null,
      };
    });
}
