import { z } from 'zod';
import { currencyCodeSchema, positiveMinorAmountSchema } from './money.js';

export const categoryBudgetPeriodSchema = z.literal('monthly');

export const categoryBudgetSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  categoryId: z.string().uuid(),
  currency: currencyCodeSchema,
  amountMinor: positiveMinorAmountSchema,
  period: categoryBudgetPeriodSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CategoryBudget = z.infer<typeof categoryBudgetSchema>;

export const upsertCategoryBudgetInputSchema = z.object({
  categoryId: z.string().uuid(),
  currency: currencyCodeSchema,
  amountMinor: positiveMinorAmountSchema,
});

export type UpsertCategoryBudgetInput = z.infer<typeof upsertCategoryBudgetInputSchema>;
