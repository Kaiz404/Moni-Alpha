import { randomUUID } from 'expo-crypto';
import type { CategoryBudget } from '@repo/types';
import { categoryBudgets$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';

type BudgetRow = {
  id: string;
  user_id: string | null;
  category_id: string | null;
  amount: string | number | null;
  period: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted?: boolean;
};

function rowToBudget(row: BudgetRow): CategoryBudget {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    categoryId: row.category_id ?? '',
    amount: parseFloat(String(row.amount ?? '0')),
    period: (row.period as CategoryBudget['period']) ?? 'monthly',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

export async function getCategoryBudgets(): Promise<CategoryBudget[]> {
  const userId = await getUserId();
  if (!userId) return [];

  return getRecordValues<BudgetRow>(categoryBudgets$)
    .filter((r) => r.user_id === userId)
    .map(rowToBudget);
}

export async function upsertCategoryBudget(
  categoryId: string,
  amount: number,
): Promise<CategoryBudget> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const existing = getRecordValues<BudgetRow>(categoryBudgets$).find(
    (r) => r.user_id === userId && r.category_id === categoryId,
  );

  if (existing?.id) {
    patchRow(categoryBudgets$, existing.id, {
      amount,
      updated_at: now,
    });
    const row = getRecordValues<BudgetRow>(categoryBudgets$).find((r) => r.id === existing.id);
    if (!row) throw new Error('Failed to update budget');
    return rowToBudget(row);
  }

  const id = randomUUID();
  categoryBudgets$[id].set({
    id,
    user_id: userId,
    category_id: categoryId,
    amount,
    period: 'monthly',
    deleted: false,
  });

  const row = getRecordValues<BudgetRow>(categoryBudgets$).find((r) => r.id === id);
  if (!row) throw new Error('Failed to create budget');
  return rowToBudget(row);
}

export async function deleteCategoryBudget(categoryId: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const existing = getRecordValues<BudgetRow>(categoryBudgets$).find(
    (r) => r.user_id === userId && r.category_id === categoryId,
  );
  if (!existing) return;

  patchRow(categoryBudgets$, existing.id, {
    deleted: true,
    updated_at: new Date().toISOString(),
  });
}
