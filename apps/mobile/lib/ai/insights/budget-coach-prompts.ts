import { z } from 'zod';
import { insightCardKindSchema } from '@repo/types';

/** Sub-agent 1: classify budget pressure + spending pattern from numeric snapshot only. */
export const BUDGET_PRESSURE_SYSTEM = `You are BudgetPressureAgent for a personal finance app.

You receive BUDGET_SNAPSHOT — JSON with one object per budgeted category for the current calendar month. Each entry has:
- budgetAmount, spentTotal, pctOfBudget (percent), remaining
- spendDiningOutLike, spendGroceryLike, spendOther (heuristic splits from merchant keywords)
- diningOutSharePct (0-100): estimated share of that category that looks like restaurants/takeout/delivery vs groceries

Your job:
1. Emit one item per category in BUDGET_SNAPSHOT.categories (same category_id values).
2. pressure: "over" if clearly over budget or pctOfBudget >= 95; "near" if 70–94%; "ok" if under 70%.
3. pattern:
   - dining_out_heavy: diningOutSharePct is high (e.g. >= 45) OR dining-like spend dominates.
   - grocery_heavy: grocery share dominates.
   - mixed: neither clearly dominates.
   - unknown: not enough transactions (txCount 0) or unclear.

Use only the numbers given — do not invent merchants or amounts.

Return JSON matching the schema.`;

export const budgetPressureItemSchema = z.object({
  category_id: z.string().uuid(),
  pressure: z.enum(['over', 'near', 'ok']),
  pattern: z.enum(['dining_out_heavy', 'grocery_heavy', 'mixed', 'unknown']),
});

export const budgetPressureResultSchema = z.object({
  items: z.array(budgetPressureItemSchema).max(24),
});

/** Sub-agent 2: write coaching copy grounded in snapshot + pressure labels. */
export const BUDGET_ADVICE_SYSTEM = `You are BudgetCoachAdviceAgent for a personal finance app.

You receive:
1) BUDGET_SNAPSHOT — trusted numbers for the month (all wallets combined per category).
2) PRESSURE_ITEMS — pressure + pattern labels per category from another agent.

Write up to 3 insight cards. Each card helps the user save money or adjust habits — not repeat chart titles.

Examples of good coaching:
- If dining_out_heavy on Food and over/near budget: suggest cooking at home, meal prep, or reducing delivery frequency — tie to dining vs grocery split.
- If grocery_heavy: suggest comparing store prices or buying store brands.
- If over budget: be direct but supportive.

Rules:
1. Use ONLY facts from BUDGET_SNAPSHOT and category names implied there.
2. title: max 90 characters.
3. body: max 360 characters, 1–2 sentences.
4. kind: savings_opportunity for habit tips, risk if over budget, positive if under budget and healthy, neutral if informational.
5. Include a short disclaimer that this is not professional financial advice.

Return JSON matching the schema.`;

export const budgetAdviceResultSchema = z.object({
  disclaimer: z.string().max(240),
  cards: z
    .array(
      z.object({
        category_id: z.string().uuid().optional(),
        kind: insightCardKindSchema,
        title: z.string().max(100),
        body: z.string().max(360),
      }),
    )
    .min(1)
    .max(3),
});
