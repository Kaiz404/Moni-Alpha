import { randomUUID } from 'expo-crypto';
import type { CategoryBudget } from '@repo/types';
import { syncSystem } from '@/lib/powersync/Powersync';

function rowToBudget(row: {
  id: string;
  user_id: string | null;
  category_id: string | null;
  amount: string | null;
  period: string | null;
  created_at: string | null;
  updated_at: string | null;
}): CategoryBudget {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    categoryId: row.category_id ?? '',
    amount: parseFloat(row.amount || '0'),
    period: (row.period as CategoryBudget['period']) ?? 'monthly',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

export async function getCategoryBudgets(): Promise<CategoryBudget[]> {
  const { db, supabaseConnector } = syncSystem;
  const userId = await supabaseConnector.getUserId();
  if (!userId) return [];

  const rows = await db
    .selectFrom('category_budgets')
    .selectAll()
    .where('user_id', '=', userId)
    .execute();

  return rows.map((r) => rowToBudget(r as Parameters<typeof rowToBudget>[0]));
}

export async function upsertCategoryBudget(categoryId: string, amount: number): Promise<CategoryBudget> {
  const { db, supabaseConnector } = syncSystem;
  const userId = await supabaseConnector.getUserId();
  if (!userId) throw new Error('Not authenticated');

  const now = new Date().toISOString();

  const existing = await db
    .selectFrom('category_budgets')
    .select(['id'])
    .where('user_id', '=', userId)
    .where('category_id', '=', categoryId)
    .executeTakeFirst();

  if (existing?.id) {
    await db
      .updateTable('category_budgets')
      .set({
        amount: amount.toString(),
        updated_at: now,
      })
      .where('id', '=', existing.id)
      .execute();
    const row = await db
      .selectFrom('category_budgets')
      .selectAll()
      .where('id', '=', existing.id)
      .executeTakeFirst();
    return rowToBudget(row as Parameters<typeof rowToBudget>[0]);
  }

  const id = randomUUID();
  await db
    .insertInto('category_budgets')
    .values({
      id,
      user_id: userId,
      category_id: categoryId,
      amount: amount.toString(),
      period: 'monthly',
      created_at: now,
      updated_at: now,
    })
    .execute();

  const row = await db
    .selectFrom('category_budgets')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  return rowToBudget(row as Parameters<typeof rowToBudget>[0]);
}

export async function deleteCategoryBudget(categoryId: string): Promise<void> {
  const { db, supabaseConnector } = syncSystem;
  const userId = await supabaseConnector.getUserId();
  if (!userId) throw new Error('Not authenticated');

  await db
    .deleteFrom('category_budgets')
    .where('user_id', '=', userId)
    .where('category_id', '=', categoryId)
    .execute();
}
