import { randomUUID } from 'expo-crypto';
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategory,
  type UpdateCategory,
} from '@repo/types';
import { categories$ } from '@/lib/store';
import { getRecordValues, isActive, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';

type CategoryRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  icon: string | null;
  color: string | null;
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
    type: c.type,
    isActive: isActive(c.is_active),
    displayOrder: c.display_order,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function getAllCategoryRows(userId: string | null, includeArchived = false): CategoryRow[] {
  const merged = getRecordValues<CategoryRow>(categories$).filter(
    (c) => includeArchived || isActive(c.is_active),
  );

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

export async function createCategory(input: CreateCategory) {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const category = createCategorySchema.parse(input);
  const current = getAllCategoryRows(userId, true);
  const duplicate = current.some(
    (row) =>
      isActive(row.is_active) &&
      row.type === category.type &&
      row.name?.trim().toLocaleLowerCase() === category.name.toLocaleLowerCase() &&
      (row.user_id === null || row.user_id === userId),
  );
  if (duplicate) throw new Error('An active category with this name already exists.');

  const displayOrder =
    Math.max(
      100,
      ...current
        .filter((row) => row.user_id === userId && row.type === category.type)
        .map((row) => row.display_order ?? 0),
    ) + 1;
  const id = randomUUID();
  categories$[id].set({
    id,
    user_id: userId,
    name: category.name,
    icon: category.icon,
    color: category.color,
    type: category.type,
    is_active: true,
    display_order: displayOrder,
    deleted: false,
  });
  return id;
}

export async function updateCategory(categoryId: string, input: UpdateCategory): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const update = updateCategorySchema.parse(input);
  const row = getRecordValues<CategoryRow>(categories$).find((item) => item.id === categoryId);
  if (!row || row.user_id !== userId) throw new Error('Only custom categories can be changed.');
  patchRow(categories$, categoryId, {
    ...(update.name === undefined ? {} : { name: update.name }),
    ...(update.icon === undefined ? {} : { icon: update.icon }),
    ...(update.color === undefined ? {} : { color: update.color }),
    ...(update.isActive === undefined ? {} : { is_active: update.isActive }),
    updated_at: new Date().toISOString(),
  });
}

export async function archiveCategory(categoryId: string): Promise<void> {
  await updateCategory(categoryId, { isActive: false });
}

export async function restoreCategory(categoryId: string): Promise<void> {
  await updateCategory(categoryId, { isActive: true });
}

/** Minimal category rows for name maps in list/chart screens. */
export async function getCategoryNameRows(): Promise<{ id: string; name: string | null }[]> {
  const userId = await getUserId();
  return getAllCategoryRows(userId).map((c) => ({
    id: c.id,
    name: c.name,
  }));
}

/** Expense categories (system + user) for budget screens. */
export async function getExpenseCategoriesForBudgets(): Promise<
  { id: string; name: string; color: string | null }[]
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
