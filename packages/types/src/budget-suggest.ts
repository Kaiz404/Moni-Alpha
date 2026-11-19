import { z } from 'zod';

import { moniToneSchema } from './chat';
import { currencyCodeSchema } from './money';

/** One month of spending the suggestion starts from, oldest first on the wire. */
export const budgetSuggestMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  spentMinor: z.number().int().nonnegative(),
});

/** A question Moni asked and what the user answered, in the order asked. */
export const budgetSuggestAnswerSchema = z.object({
  question: z.string().min(1).max(200),
  answer: z.string().min(1).max(200),
});

/**
 * Wire request for POST /v1/budget/suggest. Without answers Moni asks its questions; with them it
 * suggests a monthly amount. `category` null asks about the monthly total.
 */
export const budgetSuggestRequestSchema = z.object({
  category: z.string().min(1).max(100).nullable(),
  currency: currencyCodeSchema,
  months: z.array(budgetSuggestMonthSchema).max(6),
  answers: z.array(budgetSuggestAnswerSchema).max(6),
  tone: moniToneSchema.optional(),
});

export type BudgetSuggestRequest = z.infer<typeof budgetSuggestRequestSchema>;
export type BudgetSuggestAnswer = z.infer<typeof budgetSuggestAnswerSchema>;

export const budgetQuestionSchema = z.object({
  text: z.string().min(1).max(200),
  /** Short answers to tap; the user can always type their own. */
  choices: z.array(z.string().min(1).max(60)).max(4),
});

export type BudgetQuestion = z.infer<typeof budgetQuestionSchema>;

export const budgetSuggestQuestionsSchema = z.object({
  status: z.literal('ok'),
  step: z.literal('questions'),
  questions: z.array(budgetQuestionSchema).min(1).max(3),
  modelId: z.string(),
});

export const budgetSuggestAmountSchema = z.object({
  status: z.literal('ok'),
  step: z.literal('suggestion'),
  /** Whole units in minor units, as budgets are kept. */
  amountMinor: z.number().int().positive(),
  /** One short sentence on how Moni got there. */
  note: z.string().max(300),
  modelId: z.string(),
});

export const budgetSuggestUnavailableSchema = z.object({
  status: z.literal('unavailable'),
  reason: z.string(),
});

export const budgetSuggestResultSchema = z.union([
  budgetSuggestQuestionsSchema,
  budgetSuggestAmountSchema,
  budgetSuggestUnavailableSchema,
]);

export type BudgetSuggestResult = z.infer<typeof budgetSuggestResultSchema>;
