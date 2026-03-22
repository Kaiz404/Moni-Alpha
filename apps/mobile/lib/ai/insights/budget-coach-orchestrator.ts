/**
 * Budget coach: deterministic snapshot → pressure/pattern sub-agent → advice sub-agent.
 */
import { generateObject } from 'ai';
import type { BudgetCoachCardsV1 } from '@repo/types';
import { budgetCoachCardsV1Schema } from '@repo/types';
import * as Crypto from 'expo-crypto';
import { MAIN_MODEL_ID } from '@/lib/ai/model-manager';
import {
  BUDGET_ADVICE_SYSTEM,
  BUDGET_PRESSURE_SYSTEM,
  budgetAdviceResultSchema,
  budgetPressureResultSchema,
} from './budget-coach-prompts';
import {
  buildBudgetCoachSnapshot,
  stableBudgetCoachSnapshotString,
  type BudgetCoachToolSnapshot,
  type BudgetRow,
} from './budget-coach-metrics';
import type { TxForMetrics } from './insight-metrics';

export type BudgetCoachTrace = {
  stages: { name: string; ok: boolean; detail?: string }[];
  modelId: string | null;
};

export type BudgetCoachOrchestrationResult = {
  ok: boolean;
  inputHash: string;
  snapshot: BudgetCoachToolSnapshot;
  result: BudgetCoachCardsV1;
  trace: BudgetCoachTrace;
};

async function sha256Hex(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

const NOT_ADVICE =
  'These tips are informational only and are not financial, legal, or tax advice.';

function pressureSubAgent(
  model: any,
  snapshot: BudgetCoachToolSnapshot,
  trace: BudgetCoachTrace,
) {
  return (async () => {
    try {
      const { object } = await generateObject({
        model,
        schema: budgetPressureResultSchema,
        system: BUDGET_PRESSURE_SYSTEM,
        prompt: `BUDGET_SNAPSHOT:\n${stableBudgetCoachSnapshotString(snapshot)}`,
        temperature: 0,
      });
      trace.stages.push({ name: 'pressure', ok: true });
      return object;
    } catch (e) {
      trace.stages.push({
        name: 'pressure',
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  })();
}

function adviceSubAgent(
  model: any,
  snapshot: BudgetCoachToolSnapshot,
  pressureJson: string,
  trace: BudgetCoachTrace,
) {
  return (async () => {
    try {
      const { object } = await generateObject({
        model,
        schema: budgetAdviceResultSchema,
        system: BUDGET_ADVICE_SYSTEM,
        prompt: `BUDGET_SNAPSHOT:\n${stableBudgetCoachSnapshotString(snapshot)}\n\nPRESSURE_ITEMS:\n${pressureJson}`,
        temperature: 0.15,
      });
      trace.stages.push({ name: 'advice', ok: true });
      return object;
    } catch (e) {
      trace.stages.push({
        name: 'advice',
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  })();
}

function deterministicPressureFallback(snapshot: BudgetCoachToolSnapshot) {
  const items = snapshot.categories.map((c) => {
    const pct = c.pctOfBudget ?? 0;
    let pressure: 'over' | 'near' | 'ok' = 'ok';
    if (pct >= 100 || c.remaining < 0) pressure = 'over';
    else if (pct >= 70) pressure = 'near';

    let pattern: 'dining_out_heavy' | 'grocery_heavy' | 'mixed' | 'unknown' = 'unknown';
    if (c.txCount === 0) pattern = 'unknown';
    else if ((c.diningOutSharePct ?? 0) >= 45) pattern = 'dining_out_heavy';
    else if (c.spendGroceryLike >= c.spendDiningOutLike * 1.2 && c.spendGroceryLike > 0)
      pattern = 'grocery_heavy';
    else pattern = 'mixed';

    return { category_id: c.categoryId, pressure, pattern };
  });
  return { items };
}

function buildFallbackAdvice(snapshot: BudgetCoachToolSnapshot): BudgetCoachCardsV1 {
  const cards: BudgetCoachCardsV1['cards'] = [];
  const sym = snapshot.currencyHint;

  for (const c of snapshot.categories) {
    if (cards.length >= 3) break;
    const pct = c.pctOfBudget ?? 0;
    if (pct >= 100 || c.remaining < 0) {
      cards.push({
        kind: 'risk',
        title: `${c.categoryName}: over monthly cap`,
        body: `You are at about ${pct.toFixed(0)}% of your ${sym} ${c.budgetAmount.toFixed(2)} budget (${sym} ${c.spentTotal.toFixed(2)} spent). Trim discretionary spend or raise the budget next month.`,
        categoryId: c.categoryId,
      });
    } else if ((c.diningOutSharePct ?? 0) >= 45 && pct >= 60) {
      cards.push({
        kind: 'savings_opportunity',
        title: `Eat out less in ${c.categoryName}`,
        body: `A large share of this category looks like dining out or delivery. Cooking at home or packing lunch a few days a week can bring this closer to your ${sym} ${c.budgetAmount.toFixed(2)} goal.`,
        categoryId: c.categoryId,
      });
    }
  }

  if (cards.length === 0) {
    const worst = [...snapshot.categories].sort(
      (a, b) => (b.pctOfBudget ?? 0) - (a.pctOfBudget ?? 0),
    )[0];
    if (worst) {
      cards.push({
        kind: 'neutral',
        title: `${worst.categoryName} check-in`,
        body: `You have spent ${sym} ${worst.spentTotal.toFixed(2)} of ${sym} ${worst.budgetAmount.toFixed(2)} this month (${(worst.pctOfBudget ?? 0).toFixed(0)}%).`,
        categoryId: worst.categoryId,
      });
    }
  }

  if (cards.length === 0) {
    cards.push({
      kind: 'positive',
      title: 'Budgets on track',
      body: 'Your budgeted categories look healthy for this month. Keep logging expenses for sharper coaching.',
    });
  }

  return {
    schema: 'budget_coach_cards_v1',
    disclaimer: NOT_ADVICE,
    cards: cards.slice(0, 3),
    trace: { stages: ['deterministic_fallback'] },
  };
}

export async function computeBudgetCoachInputHash(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: BudgetRow[],
  currencyHint: string,
  now?: Date,
): Promise<{ inputHash: string; snapshot: BudgetCoachToolSnapshot }> {
  const snapshot = buildBudgetCoachSnapshot(transactions, categoryMap, budgets, currencyHint, now);
  const inputHash = await sha256Hex(stableBudgetCoachSnapshotString(snapshot));
  return { inputHash, snapshot };
}

export async function runBudgetCoachOrchestration(
  model: any | null,
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: BudgetRow[],
  currencyHint: string,
  now: Date = new Date(),
): Promise<BudgetCoachOrchestrationResult> {
  const trace: BudgetCoachTrace = { stages: [], modelId: model ? MAIN_MODEL_ID : null };
  const snapshot = buildBudgetCoachSnapshot(transactions, categoryMap, budgets, currencyHint, now);
  const inputHash = await sha256Hex(stableBudgetCoachSnapshotString(snapshot));

  if (budgets.length === 0) {
    const empty: BudgetCoachCardsV1 = {
      schema: 'budget_coach_cards_v1',
      disclaimer: NOT_ADVICE,
      cards: [
        {
          kind: 'neutral',
          title: 'Set category budgets',
          body: 'Add monthly budgets per category in Profile → Category budgets. Moni will compare all wallets and coach you with on-device AI.',
        },
      ],
      trace: { stages: ['no_budgets_configured'] },
    };
    return { ok: true, inputHash, snapshot, result: empty, trace };
  }

  if (!model) {
    trace.stages.push({ name: 'model', ok: false, detail: 'unavailable' });
    const result = buildFallbackAdvice(snapshot);
    return { ok: true, inputHash, snapshot, result, trace };
  }

  let pressure = await pressureSubAgent(model, snapshot, trace);
  if (!pressure?.items?.length) {
    pressure = deterministicPressureFallback(snapshot);
    trace.stages.push({ name: 'pressure', ok: true, detail: 'deterministic_fallback' });
  }

  const pressureJson = JSON.stringify(pressure.items);
  let advice = await adviceSubAgent(model, snapshot, pressureJson, trace);

  if (!advice?.cards?.length) {
    const result = buildFallbackAdvice(snapshot);
    trace.stages.push({ name: 'advice', ok: false, detail: 'fallback_templates' });
    return { ok: true, inputHash, snapshot, result, trace };
  }

  const parsed = budgetCoachCardsV1Schema.safeParse({
    schema: 'budget_coach_cards_v1',
    disclaimer: advice.disclaimer || NOT_ADVICE,
    cards: advice.cards.map((c) => ({
      kind: c.kind,
      title: c.title,
      body: c.body,
      categoryId: c.category_id,
    })),
    trace: { stages: ['pressure', 'advice'] },
  });

  if (!parsed.success) {
    const result = buildFallbackAdvice(snapshot);
    trace.stages.push({ name: 'validate', ok: false, detail: 'schema_fallback' });
    return { ok: true, inputHash, snapshot, result, trace };
  }

  return {
    ok: true,
    inputHash,
    snapshot,
    result: parsed.data,
    trace,
  };
}
