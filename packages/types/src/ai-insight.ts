import { z } from 'zod';

/** Identifies which AI finance feature produced this row. */
export const aiInsightFeatureKeySchema = z.enum([
  'summary_insight_cards',
  'budget_coach_cards',
  'moni_finance_assistant',
]);

export const financeAssistantAgentKeySchema = z.enum([
  'spending_trend',
  'budget_advisor',
  'spending_story',
]);

/** Distinguishes scope within a feature, e.g. global summary vs per-wallet. */
export const aiInsightContextKeySchema = z.string().min(1).max(256);

export const aiInsightStatusSchema = z.enum(['pending', 'ready', 'error']);

export const insightCardKindSchema = z.enum([
  'savings_opportunity',
  'risk',
  'positive',
  'neutral',
]);

/** Payload stored in `result` for summary_insight_cards v1. */
export const summaryInsightCardsV1Schema = z.object({
  schema: z.literal('summary_insight_cards_v1'),
  disclaimer: z.string(),
  cards: z
    .array(
      z.object({
        kind: insightCardKindSchema,
        title: z.string().max(120),
        body: z.string().max(500),
      }),
    )
    .max(5),
  trace: z
    .object({
      highlight_metric_keys: z.array(z.string()).optional(),
    })
    .optional(),
});

export type SummaryInsightCardsV1 = z.infer<typeof summaryInsightCardsV1Schema>;

/** Budget coach: grounded in category budgets + spend patterns (all wallets). */
export const budgetCoachCardsV1Schema = z.object({
  schema: z.literal('budget_coach_cards_v1'),
  disclaimer: z.string(),
  cards: z
    .array(
      z.object({
        kind: insightCardKindSchema,
        title: z.string().max(120),
        body: z.string().max(500),
        categoryId: z.string().uuid().optional(),
      }),
    )
    .max(5),
  trace: z
    .object({
      stages: z.array(z.string()).optional(),
    })
    .optional(),
});

export type BudgetCoachCardsV1 = z.infer<typeof budgetCoachCardsV1Schema>;

const financeInsightBlockSchema = z.object({
  agentKey: financeAssistantAgentKeySchema,
  label: z.string().max(48),
  title: z.string().max(160),
  /** Kept short on-device (≈5 sentences per agent). */
  body: z.string().max(1200),
});

/** Three on-device agents: trend vs prior month + rolling window, budgets, spending narrative. */
export const moniFinanceAssistantV1Schema = z.object({
  schema: z.literal('moni_finance_assistant_v1'),
  disclaimer: z.string(),
  insights: z.array(financeInsightBlockSchema).length(3),
  trace: z
    .object({
      stages: z.array(z.string()).optional(),
    })
    .optional(),
});

export type MoniFinanceAssistantV1 = z.infer<typeof moniFinanceAssistantV1Schema>;

export const aiInsightResultSchema = z.discriminatedUnion('schema', [
  summaryInsightCardsV1Schema,
  budgetCoachCardsV1Schema,
  moniFinanceAssistantV1Schema,
]);

export type AiInsightResult = z.infer<typeof aiInsightResultSchema>;
