/**
 * Moni Finance Assistant: 3 sequential sub-agents (trend, budget, story) → one DB payload.
 */
import { generateObject } from 'ai';
import type { MoniFinanceAssistantV1 } from '@repo/types';
import { moniFinanceAssistantV1Schema } from '@repo/types';
import * as Crypto from 'expo-crypto';
import { MAIN_MODEL_ID } from '@/lib/ai/model-manager';
import {
  BUDGET_AGENT_SYSTEM,
  STORY_AGENT_SYSTEM,
  TREND_AGENT_SYSTEM,
} from './finance-assistant-prompts';
import {
  buildFinanceAssistantToolSnapshot,
  stableFinanceAssistantSnapshotString,
  type FinanceAssistantToolSnapshot,
  type BudgetRow,
} from './finance-assistant-metrics';
import type { TxForMetrics } from './insight-metrics';
import { z } from 'zod';

const singleBlockSchema = z.object({
  label: z.string().max(48),
  title: z.string().max(140),
  body: z.string().max(1200),
});

export type FinanceAssistantTrace = {
  stages: { name: string; ok: boolean; detail?: string }[];
  modelId: string | null;
};

export type FinanceAssistantOrchestrationResult = {
  ok: boolean;
  inputHash: string;
  snapshot: FinanceAssistantToolSnapshot;
  result: MoniFinanceAssistantV1;
  trace: FinanceAssistantTrace;
};

async function sha256Hex(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

const NOT_ADVICE =
  'Moni is not a financial advisor. These notes are generated on-device for demo purposes only.';

function fallbackTrend(s: FinanceAssistantToolSnapshot): z.infer<typeof singleBlockSchema> {
  const c = s.calendarMonth;
  const r = s.rolling30;
  const sym = c.currencyHint;
  const pct = c.pctExpenseChangeVsPreviousFullMonth;
  const rollPct = r.deltas.expensePctVsPrior;
  const projection =
    pct != null
      ? `If you project this month using your recent daily pace, spending is roughly ${pct >= 0 ? 'up' : 'down'} about ${Math.abs(pct).toFixed(1)}% versus last month full total — use this as a directional signal, not a forecast.`
      : `Not enough data to compare projected month-end spend to ${c.previousMonthKey} yet.`;

  const rolling = `In the rolling ${r.periodDays}-day window, expenses were ${sym} ${r.current.expenseTotal.toFixed(2)} vs ${sym} ${r.prior.expenseTotal.toFixed(2)} before${rollPct != null ? ` (${rollPct >= 0 ? '+' : ''}${rollPct.toFixed(1)}% change)` : ''}.`;
  const netLine = `Net in that window is ${sym} ${r.current.net.toFixed(2)}${r.rates.savingsMargin != null ? `; savings margin about ${r.rates.savingsMargin.toFixed(1)}% of income.` : '.'}`;
  const focus =
    (rollPct ?? 0) > 5
      ? 'Consider trimming the categories that grew the most.'
      : 'Keep logging transactions so trends stay clear.';

  return {
    label: 'Trend Strategist',
    title: `Spending pulse: ${c.currentMonthKey} vs ${c.previousMonthKey}`,
    body: [
      `So far this month you have spent about ${sym} ${c.expenseCurrentMonthToDate.toFixed(2)} (day ${c.dayOfMonthNow} of ${c.daysInCurrentMonth}), vs ${sym} ${c.expensePreviousCalendarMonth.toFixed(2)} for all of ${c.previousMonthKey}.`,
      projection,
      rolling,
      netLine,
      focus,
    ].join(' '),
  };
}

function fallbackBudget(s: FinanceAssistantToolSnapshot): z.infer<typeof singleBlockSchema> {
  const b = s.budgetCoach;
  const sym = b.currencyHint;
  if (!b.categories.length) {
    return {
      label: 'Budget Advisor',
      title: 'Set budgets to unlock deeper coaching',
      body:
        'You have not set monthly category budgets yet. Add caps under Profile → Category budgets so Moni can compare all wallets and flag dining-style vs grocery-style pressure. Refresh after saving to update coaching.',
    };
  }
  const worst = [...b.categories].sort(
    (a, b) => (b.pctOfBudget ?? 0) - (a.pctOfBudget ?? 0),
  )[0];
  const dining =
    worst.diningOutSharePct != null && worst.diningOutSharePct >= 40
      ? `Much of this looks like dining or delivery (${worst.diningOutSharePct.toFixed(0)}% of the category).`
      : 'Review repeat merchants for easy cuts.';
  const tops =
    worst.topMerchants.slice(0, 2).map((m) => `${m.name} (${sym} ${m.amount.toFixed(2)})`).join(', ') ||
    'n/a';

  return {
    label: 'Budget Advisor',
    title: `${worst.categoryName} needs the most attention`,
    body: [
      `You are at about ${worst.pctOfBudget != null ? `${worst.pctOfBudget.toFixed(0)}%` : 'part'} of your ${sym} ${worst.budgetAmount.toFixed(2)} monthly budget (${sym} ${worst.spentTotal.toFixed(2)} spent).`,
      dining,
      `Largest lines recently: ${tops}.`,
      `Try one smaller habit next week (e.g. one more home-cooked meal or one fewer delivery) and re-check here.`,
    ].join(' '),
  };
}

function fallbackStory(s: FinanceAssistantToolSnapshot): z.infer<typeof singleBlockSchema> {
  const st = s.spendingStory;
  const sym = st.currencyHint;
  const top = st.topCategories[0];
  const mer = st.topMerchants[0];
  const categoryLine = top
    ? `Largest category: ${top.name} at about ${top.sharePct.toFixed(1)}% of expenses (${sym} ${top.amount.toFixed(2)}).`
    : 'No category breakdown available for this period.';
  const merchantLine = mer
    ? `Merchant spotlight: ${mer.name} represents ~${mer.sharePct.toFixed(1)}% of expenses (${sym} ${mer.amount.toFixed(2)}).`
    : '';

  const spread = `Across ${st.expenseTransactionCount} expense transactions, concentration is ${st.categoryConcentration.toFixed(2)} (${st.categoryConcentration >= 0.35 ? 'fairly focused in a few categories' : 'spread more evenly'}).`;

  return {
    label: 'Spending Story',
    title: `Where your money went (${st.periodLabel})`,
    body: [spread, categoryLine, merchantLine, 'Try a two-week cap on your top category and move a small fixed sum to savings if it helps.']
      .filter(Boolean)
      .join(' '),
  };
}

async function runSubAgent(
  model: any,
  system: string,
  userPrompt: string,
  trace: FinanceAssistantTrace,
  name: string,
): Promise<z.infer<typeof singleBlockSchema> | null> {
  try {
    const { object } = await generateObject({
      model,
      schema: singleBlockSchema,
      system,
      prompt: userPrompt,
      temperature: 0.15,
    });
    trace.stages.push({ name, ok: true });
    return object;
  } catch (e) {
    trace.stages.push({
      name,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function computeFinanceAssistantInputHash(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: BudgetRow[],
  currencyHint: string,
  now?: Date,
): Promise<{ inputHash: string; snapshot: FinanceAssistantToolSnapshot }> {
  const snapshot = buildFinanceAssistantToolSnapshot(
    transactions,
    categoryMap,
    budgets,
    currencyHint,
    now,
  );
  const inputHash = await sha256Hex(stableFinanceAssistantSnapshotString(snapshot));
  return { inputHash, snapshot };
}

export async function runFinanceAssistantOrchestration(
  model: any | null,
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: BudgetRow[],
  currencyHint: string,
  now: Date = new Date(),
): Promise<FinanceAssistantOrchestrationResult> {
  const trace: FinanceAssistantTrace = { stages: [], modelId: model ? MAIN_MODEL_ID : null };
  const snapshot = buildFinanceAssistantToolSnapshot(
    transactions,
    categoryMap,
    budgets,
    currencyHint,
    now,
  );
  const inputHash = await sha256Hex(stableFinanceAssistantSnapshotString(snapshot));

  const trendPrompt = `TREND_DATA:\n${JSON.stringify(
    { calendarMonth: snapshot.calendarMonth, rolling30: snapshot.rolling30 },
    null,
    2,
  )}`;

  const budgetPrompt = `BUDGET_SNAPSHOT:\n${JSON.stringify(snapshot.budgetCoach, null, 2)}`;

  const storyPrompt = `STORY_SNAPSHOT:\n${JSON.stringify(snapshot.spendingStory, null, 2)}`;

  let trendBlock: z.infer<typeof singleBlockSchema> | null = null;
  let budgetBlock: z.infer<typeof singleBlockSchema> | null = null;
  let storyBlock: z.infer<typeof singleBlockSchema> | null = null;

  if (model) {
    trendBlock = await runSubAgent(model, TREND_AGENT_SYSTEM, trendPrompt, trace, 'trend_agent');
    budgetBlock = await runSubAgent(model, BUDGET_AGENT_SYSTEM, budgetPrompt, trace, 'budget_agent');
    storyBlock = await runSubAgent(model, STORY_AGENT_SYSTEM, storyPrompt, trace, 'story_agent');
  }

  if (!trendBlock) trendBlock = fallbackTrend(snapshot);
  if (!budgetBlock) budgetBlock = fallbackBudget(snapshot);
  if (!storyBlock) storyBlock = fallbackStory(snapshot);

  const result: MoniFinanceAssistantV1 = {
    schema: 'moni_finance_assistant_v1',
    disclaimer: NOT_ADVICE,
    insights: [
      {
        agentKey: 'spending_trend',
        label: trendBlock.label,
        title: trendBlock.title,
        body: trendBlock.body,
      },
      {
        agentKey: 'budget_advisor',
        label: budgetBlock.label,
        title: budgetBlock.title,
        body: budgetBlock.body,
      },
      {
        agentKey: 'spending_story',
        label: storyBlock.label,
        title: storyBlock.title,
        body: storyBlock.body,
      },
    ],
    trace: {
      stages: trace.stages.map((s) => `${s.name}:${s.ok ? 'ok' : 'fail'}`),
    },
  };

  const parsed = moniFinanceAssistantV1Schema.safeParse(result);
  if (!parsed.success) {
    trace.stages.push({ name: 'validate', ok: false, detail: 'schema_fallback' });
    return {
      ok: true,
      inputHash,
      snapshot,
      result: {
        schema: 'moni_finance_assistant_v1',
        disclaimer: NOT_ADVICE,
        insights: [
          {
            agentKey: 'spending_trend',
            ...fallbackTrend(snapshot),
          },
          {
            agentKey: 'budget_advisor',
            ...fallbackBudget(snapshot),
          },
          {
            agentKey: 'spending_story',
            ...fallbackStory(snapshot),
          },
        ],
      },
      trace,
    };
  }

  return { ok: true, inputHash, snapshot, result: parsed.data, trace };
}
