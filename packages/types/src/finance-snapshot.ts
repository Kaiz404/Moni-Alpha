import { z } from 'zod';

import { recurringKindSchema } from './recurring-override';

/**
 * The finance snapshot Moni chat sends with a question (`POST /v1/chat/analyze`): deterministic
 * metrics computed on the phone, one block per ISO currency, so the model narrates and never
 * computes. Amounts are decimals in that block's currency. The backend passes it to the prompt
 * as JSON without reading its fields.
 */

const amountByNameSchema = z.object({ name: z.string(), amount: z.number() });

const periodTotalsSchema = z.object({
  startIso: z.string(),
  endIso: z.string(),
  expenseTotal: z.number(),
  incomeTotal: z.number(),
  net: z.number(),
  transactionCount: z.number(),
});

/** The last 30 days against the 30 before. */
export const insightMetricSnapshotSchema = z.object({
  periodDays: z.literal(30),
  currencyHint: z.string(),
  generatedAt: z.string(),
  current: periodTotalsSchema,
  prior: periodTotalsSchema,
  topCategories: z.array(amountByNameSchema),
  topMerchants: z.array(amountByNameSchema),
  largestExpense: z
    .object({
      amount: z.number(),
      merchant: z.string().nullable(),
      category: z.string().nullable(),
      date: z.string(),
    })
    .nullable(),
  deltas: z.object({
    expensePctVsPrior: z.number().nullable(),
    incomePctVsPrior: z.number().nullable(),
  }),
  rates: z.object({ dailyExpense: z.number(), savingsMargin: z.number().nullable() }),
});

export const budgetCategoryMetricSchema = z.object({
  categoryId: z.string(),
  categoryName: z.string(),
  currency: z.string(),
  budgetAmount: z.number(),
  spentTotal: z.number(),
  pctOfBudget: z.number().nullable(),
  remaining: z.number(),
  txCount: z.number(),
  spendDiningOutLike: z.number(),
  spendGroceryLike: z.number(),
  spendOther: z.number(),
  diningOutSharePct: z.number().nullable(),
  topMerchants: z.array(amountByNameSchema),
});

export const budgetCoachToolSnapshotSchema = z.object({
  schema: z.literal('budget_coach_tool_v1'),
  monthKey: z.string(),
  currencyHint: z.string(),
  generatedAt: z.string(),
  categories: z.array(budgetCategoryMetricSchema),
});

export const calendarMonthTrendSnapshotSchema = z.object({
  currencyHint: z.string(),
  currentMonthKey: z.string(),
  previousMonthKey: z.string(),
  expenseCurrentMonthToDate: z.number(),
  expensePreviousCalendarMonth: z.number(),
  dayOfMonthNow: z.number(),
  daysInCurrentMonth: z.number(),
  avgDailyExpenseCurrentMonth: z.number(),
  avgDailyExpensePreviousMonth: z.number(),
  /** Average daily spend so far vs last month's. Not a forecast; null before day 7 or when one bill dominates. */
  dailyPaceVsPreviousMonthPct: z.number().nullable(),
});

const amountShareSchema = amountByNameSchema.extend({ sharePct: z.number() });

export const spendingStorySnapshotSchema = z.object({
  currencyHint: z.string(),
  periodLabel: z.string(),
  topCategories: z.array(amountShareSchema),
  topMerchants: z.array(amountShareSchema),
  categoryConcentration: z.number(),
  expenseTransactionCount: z.number(),
});

/** Logged but not yet reviewed, so absent from every other total. */
export const pendingProposalsSnapshotSchema = z.object({
  count: z.number(),
  expenseTotal: z.number(),
  incomeTotal: z.number(),
});

export const cadenceSchema = z.enum(['weekly', 'biweekly', 'monthly']);

export const recurringFactSchema = z.object({
  name: z.string(),
  kind: recurringKindSchema,
  cadence: cadenceSchema,
  amount: z.number(),
  lastDate: z.string(),
  nextDate: z.string(),
  occurrences: z.number(),
  confidence: z.number(),
  needsConfirm: z.boolean(),
});

const forecastBasisShape = {
  historyDays: z.number(),
  /** Logged spending as a share of logged spending plus balance corrections that lowered a balance. */
  coveragePct: z.number(),
  /** Age of the stalest confirmed balance among liquid wallets in use. */
  balanceConfirmedDaysAgo: z.number().nullable(),
};

export const forecastLineSchema = z.object({ name: z.string(), amount: z.number(), date: z.string() });
export const bandSchema = z.object({ low: z.number(), likely: z.number(), high: z.number() });

export const affordSchema = z.object({
  amount: z.number(),
  worstCaseAfter: z.number(),
  likelyAfter: z.number(),
  /** True when the worst case still ends at or above zero after this spend. */
  fitsWorstCase: z.boolean(),
});

export const forecastSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ready'),
    horizon: z.enum(['payday', 'month_end']),
    horizonDate: z.string(),
    daysLeft: z.number(),
    startBalance: z.number(),
    bills: z.array(forecastLineSchema),
    billsTotal: z.number(),
    income: z.array(forecastLineSchema),
    incomeTotal: z.number(),
    /** Day-to-day spending until the horizon; `high` is the heavy-spending case. */
    variableSpend: bandSchema,
    /** Balance just before the horizon; `low` is the worst case. */
    endBalance: bandSchema,
    afford: affordSchema.optional(),
    ...forecastBasisShape,
  }),
  z.object({
    status: z.literal('insufficient'),
    reasons: z.array(z.string()),
    ...forecastBasisShape,
  }),
]);

export const financeFactsSchema = z.object({
  /** Cash, bank, debit and e-wallet accounts only; credit and investment wallets are left out. */
  balances: z
    .object({ liquid: z.number(), changeLast30Days: z.number(), walletCount: z.number() })
    .nullable(),
  recurring: z.array(recurringFactSchema),
  payday: z
    .object({ name: z.string(), amount: z.number(), cadence: cadenceSchema, nextDate: z.string() })
    .nullable(),
  forecast: forecastSchema,
});

export const financeAssistantCurrencySnapshotSchema = z.object({
  generatedAt: z.string(),
  rolling30: insightMetricSnapshotSchema,
  calendarMonth: calendarMonthTrendSnapshotSchema,
  budgetCoach: budgetCoachToolSnapshotSchema,
  spendingStory: spendingStorySnapshotSchema,
  pendingProposals: pendingProposalsSnapshotSchema,
  /** Balances, recurring series, payday and forecast; absent when the caller has no ledger facts. */
  facts: financeFactsSchema.optional(),
});

/** Every metric is scoped to exactly one currency; nothing sums across keys. */
export const financeAssistantToolSnapshotSchema = z.object({
  schema: z.literal('finance_assistant_tool_v4'),
  generatedAt: z.string(),
  currencies: z.record(financeAssistantCurrencySnapshotSchema),
});

export type InsightMetricSnapshot = z.infer<typeof insightMetricSnapshotSchema>;
export type BudgetCategoryMetric = z.infer<typeof budgetCategoryMetricSchema>;
export type BudgetCoachToolSnapshot = z.infer<typeof budgetCoachToolSnapshotSchema>;
export type CalendarMonthTrendSnapshot = z.infer<typeof calendarMonthTrendSnapshotSchema>;
export type SpendingStorySnapshot = z.infer<typeof spendingStorySnapshotSchema>;
export type PendingProposalsSnapshot = z.infer<typeof pendingProposalsSnapshotSchema>;
export type Cadence = z.infer<typeof cadenceSchema>;
export type RecurringFact = z.infer<typeof recurringFactSchema>;
export type ForecastBasis = Pick<
  z.infer<typeof forecastSchema>,
  keyof typeof forecastBasisShape
>;
export type ForecastLine = z.infer<typeof forecastLineSchema>;
export type Band = z.infer<typeof bandSchema>;
export type Afford = z.infer<typeof affordSchema>;
export type Forecast = z.infer<typeof forecastSchema>;
export type FinanceFacts = z.infer<typeof financeFactsSchema>;
export type FinanceAssistantCurrencySnapshot = z.infer<typeof financeAssistantCurrencySnapshotSchema>;
export type FinanceAssistantToolSnapshot = z.infer<typeof financeAssistantToolSnapshotSchema>;
