import { z } from 'zod';
import { insightCardKindSchema } from '@repo/types';

/** Step 1 — pick which metrics deserve a card (no prose yet). */
export const INSIGHT_HIGHLIGHT_SELECTOR_PROMPT = `You are InsightHighlightAgent for a personal finance app.

You receive USER_SNAPSHOT — JSON with pre-computed numbers only. Your job is to pick 1 to 3 highlights that would be most useful to show as insight cards.

Rules:
1. metric_key MUST be one of the allowed keys listed in the user message.
2. rank 1 = most important. Use at most 3 highlights.
3. kind:
   - savings_opportunity: user could spend less or improve savings.
   - risk: overspending, spike, or unfavorable trend.
   - positive: healthy trend or good margin.
   - neutral: factual summary without strong positive/negative.
4. Do not invent numbers; you only choose which metrics to emphasize.

Return JSON matching the schema exactly.`;

export const insightHighlightMetricKeySchema = z.enum([
  'expense_vs_prior',
  'income_vs_prior',
  'top_category',
  'top_merchant',
  'largest_expense',
  'daily_burn',
  'savings_margin',
]);

export const insightHighlightsResultSchema = z.object({
  highlights: z
    .array(
      z.object({
        metric_key: insightHighlightMetricKeySchema,
        kind: insightCardKindSchema,
        rank: z.number().int().min(1).max(3),
      }),
    )
    .min(1)
    .max(3),
});

/** Step 2 — write short titles and bodies grounded in the snapshot. */
export const INSIGHT_COPYWRITER_PROMPT = `You are InsightCopywriterAgent for a personal finance app.

You receive:
- USER_SNAPSHOT (trusted numbers)
- HIGHLIGHTS (which metrics to cover, with kinds)

Write 1–3 cards. Each card must:
1. Use ONLY figures and facts present in USER_SNAPSHOT (do not invent merchants, amounts, or dates).
2. title: max 90 characters, engaging but not clickbait.
3. body: 1–2 sentences, max 320 characters, plain language.
4. Match the kind from HIGHLIGHTS for that metric_key.

Always include disclaimer: short reminder that this is not financial advice.

Return JSON matching the schema exactly.`;

export const insightCopywriterResultSchema = z.object({
  disclaimer: z.string().max(220),
  cards: z
    .array(
      z.object({
        metric_key: insightHighlightMetricKeySchema,
        kind: insightCardKindSchema,
        title: z.string().max(100),
        body: z.string().max(320),
      }),
    )
    .min(1)
    .max(3),
});
