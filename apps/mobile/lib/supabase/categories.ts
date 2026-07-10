import { categories$ } from '@/lib/store';
import { getRecordValues, isActive } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';

type CategoryRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  type: string | null;
  is_active: boolean | number | null;
  display_order: number | null;
  created_at: string | null;
  updated_at: string | null;
  deleted?: boolean;
};

function mapCategoryRow(c: CategoryRow) {
  return {
    id: c.id,
    userId: c.user_id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    parentId: c.parent_id,
    type: c.type,
    isActive: isActive(c.is_active),
    displayOrder: c.display_order,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function getAllCategoryRows(userId: string | null): CategoryRow[] {
  const merged = getRecordValues<CategoryRow>(categories$).filter((c) => isActive(c.is_active));

  if (!userId) {
    return merged.filter((c) => c.user_id === null);
  }

  return merged.filter((c) => c.user_id === null || c.user_id === userId);
}

export async function getCategories(type?: 'income' | 'expense') {
  const userId = await getUserId();
  let categories = getAllCategoryRows(userId);

  if (type) {
    categories = categories.filter((c) => c.type === type);
  }

  categories.sort((a, b) => {
    const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  return categories.map(mapCategoryRow);
}

/** Minimal category rows for name maps in list/chart screens. */
export async function getCategoryNameRows(): Promise<Array<{ id: string; name: string | null }>> {
  const userId = await getUserId();
  return getAllCategoryRows(userId).map((c) => ({ id: c.id, name: c.name }));
}

/** Expense categories (system + user) for budget screens. */
export async function getExpenseCategoriesForBudgets(): Promise<
  Array<{ id: string; name: string; color: string | null }>
> {
  const userId = await getUserId();
  if (!userId) return [];

  return getAllCategoryRows(userId)
    .filter((c) => c.type === 'expense')
    .sort((a, b) => {
      const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return (a.name ?? '').localeCompare(b.name ?? '');
    })
    .map((c) => ({
      id: c.id,
      name: c.name ?? 'Category',
      color: c.color,
    }));
}
