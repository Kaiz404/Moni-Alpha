import { z } from 'zod';

export const categoryBudgetPeriodSchema = z.literal('monthly');

export const categoryBudgetSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  period: categoryBudgetPeriodSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CategoryBudget = z.infer<typeof categoryBudgetSchema>;

export const upsertCategoryBudgetInputSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
});

export type UpsertCategoryBudgetInput = z.infer<typeof upsertCategoryBudgetInputSchema>;
