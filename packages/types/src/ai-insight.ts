import { z } from 'zod';

/** Identifies which AI finance feature produced this row (extend over time). */
export const aiInsightFeatureKeySchema = z.enum(['summary_insight_cards']);

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
  /** Optional trace for debugging / future audit UI */
  trace: z
    .object({
      highlight_metric_keys: z.array(z.string()).optional(),
    })
    .optional(),
});

export type SummaryInsightCardsV1 = z.infer<typeof summaryInsightCardsV1Schema>;

/** Extend with `z.discriminatedUnion` when multiple insight payloads exist. */
export const aiInsightResultSchema = summaryInsightCardsV1Schema;

export type AiInsightResult = z.infer<typeof aiInsightResultSchema>;
