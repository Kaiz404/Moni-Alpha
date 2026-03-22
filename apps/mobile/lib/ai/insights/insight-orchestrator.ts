/**
 * Summary insight orchestration: deterministic metrics → highlight selection → copywriting.
 * Falls back to template cards when the model is unavailable or fails.
 */
import { generateObject } from 'ai';
import { z } from 'zod';
import type { SummaryInsightCardsV1 } from '@repo/types';
import { summaryInsightCardsV1Schema } from '@repo/types';
import * as Crypto from 'expo-crypto';
import { MAIN_MODEL_ID } from '@/lib/ai/model-manager';
import {
  INSIGHT_COPYWRITER_PROMPT,
  INSIGHT_HIGHLIGHT_SELECTOR_PROMPT,
  insightCopywriterResultSchema,
  insightHighlightsResultSchema,
} from './insight-prompts';
import {
  buildInsightMetricSnapshot,
  stableSnapshotString,
  type InsightMetricSnapshot,
  type TxForMetrics,
} from './insight-metrics';

export type InsightOrchestratorTrace = {
  stages: { name: string; ok: boolean; detail?: string }[];
  modelId: string | null;
};

export type InsightOrchestrationResult = {
  ok: boolean;
  inputHash: string;
  snapshot: InsightMetricSnapshot;
  result: SummaryInsightCardsV1;
  trace: InsightOrchestratorTrace;
};

async function sha256Hex(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

/** For UI: compare with stored `input_hash` to detect stale insights without running the LLM. */
export async function computeInsightInputHash(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  currencyHint: string,
): Promise<{ inputHash: string; snapshot: InsightMetricSnapshot }> {
  const snapshot = buildInsightMetricSnapshot(transactions, categoryMap, currencyHint);
  const inputHash = await sha256Hex(stableSnapshotString(snapshot));
  return { inputHash, snapshot };
}

const NOT_ADVICE =
  'These insights are informational only and are not financial, legal, or tax advice.';

function sortHighlights(
  h: z.infer<typeof insightHighlightsResultSchema>['highlights'],
) {
  return [...h].sort((a, b) => a.rank - b.rank);
}

export function buildFallbackInsightCards(snapshot: InsightMetricSnapshot): SummaryInsightCardsV1 {
  const cards: SummaryInsightCardsV1['cards'] = [];
  const cur = snapshot.current;
  const curSym = snapshot.currencyHint;

  const expDelta = snapshot.deltas.expensePctVsPrior;
  if (expDelta != null && snapshot.prior.expenseTotal > 0) {
    cards.push({
      kind: expDelta > 12 ? 'risk' : expDelta < -8 ? 'positive' : 'neutral',
      title: 'Spending vs last month',
      body: `In the last ${snapshot.periodDays} days you spent ${curSym} ${cur.expenseTotal.toFixed(2)} — expenses ${expDelta > 0 ? 'rose' : 'fell'} about ${Math.abs(expDelta)}% vs the prior ${snapshot.periodDays} days.`,
    });
  }

  const topCat = snapshot.topCategories[0];
  if (topCat && topCat.amount > 0) {
    const share = cur.expenseTotal > 0 ? Math.round((topCat.amount / cur.expenseTotal) * 100) : 0;
    cards.push({
      kind: share > 45 ? 'risk' : 'neutral',
      title: 'Top category',
      body: `${topCat.name} was about ${share}% of spending (${curSym} ${topCat.amount.toFixed(2)}).`,
    });
  }

  if (snapshot.largestExpense && snapshot.largestExpense.amount > 0) {
    const m = snapshot.largestExpense.merchant ?? 'a purchase';
    cards.push({
      kind: snapshot.largestExpense.amount > cur.expenseTotal * 0.35 ? 'risk' : 'neutral',
      title: 'Largest purchase',
      body: `Your biggest expense was ${curSym} ${snapshot.largestExpense.amount.toFixed(2)} (${m}).`,
    });
  }

  if (cards.length === 0) {
    cards.push({
      kind: 'neutral',
      title: 'Not enough activity yet',
      body: `Add a few more expenses or income entries to unlock richer insights. So far: ${cur.transactionCount} transaction(s) in the last ${snapshot.periodDays} days.`,
    });
  }

  const deduped: SummaryInsightCardsV1['cards'] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const k = `${c.title}|${c.body}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(c);
    if (deduped.length >= 3) break;
  }

  return {
    schema: 'summary_insight_cards_v1',
    disclaimer: NOT_ADVICE,
    cards: deduped,
    trace: { highlight_metric_keys: ['fallback'] },
  };
}

async function highlightSelectorSubAgent(
  model: any,
  snapshot: InsightMetricSnapshot,
): Promise<z.infer<typeof insightHighlightsResultSchema> | null> {
  try {
    const { object } = await generateObject({
      model,
      schema: insightHighlightsResultSchema,
      system: INSIGHT_HIGHLIGHT_SELECTOR_PROMPT,
      prompt: `Allowed metric_key values: expense_vs_prior, income_vs_prior, top_category, top_merchant, largest_expense, daily_burn, savings_margin.

USER_SNAPSHOT:
${stableSnapshotString(snapshot)}`,
      temperature: 0,
    });
    return object;
  } catch {
    return null;
  }
}

async function copywriterSubAgent(
  model: any,
  snapshot: InsightMetricSnapshot,
  highlights: z.infer<typeof insightHighlightsResultSchema>['highlights'],
): Promise<z.infer<typeof insightCopywriterResultSchema> | null> {
  try {
    const { object } = await generateObject({
      model,
      schema: insightCopywriterResultSchema,
      system: INSIGHT_COPYWRITER_PROMPT,
      prompt: `USER_SNAPSHOT:
${stableSnapshotString(snapshot)}

HIGHLIGHTS:
${JSON.stringify(sortHighlights(highlights), null, 2)}`,
      temperature: 0.2,
    });
    return object;
  } catch {
    return null;
  }
}

async function highlightsToCards(
  model: any,
  snapshot: InsightMetricSnapshot,
  highlights: z.infer<typeof insightHighlightsResultSchema>['highlights'] | null,
  trace: InsightOrchestratorTrace,
): Promise<SummaryInsightCardsV1> {
  if (!model || !highlights?.length) {
    trace.stages.push({ name: 'copywriter', ok: false, detail: 'using_fallback_templates' });
    return buildFallbackInsightCards(snapshot);
  }

  const written = await copywriterSubAgent(model, snapshot, highlights);
  if (!written?.cards?.length) {
    trace.stages.push({ name: 'copywriter', ok: false, detail: 'empty_or_failed' });
    return buildFallbackInsightCards(snapshot);
  }

  trace.stages.push({ name: 'copywriter', ok: true });

  const parsed = summaryInsightCardsV1Schema.safeParse({
    schema: 'summary_insight_cards_v1',
    disclaimer: written.disclaimer || NOT_ADVICE,
    cards: written.cards.map((c) => ({
      kind: c.kind,
      title: c.title,
      body: c.body,
    })),
    trace: { highlight_metric_keys: highlights.map((h) => h.metric_key) },
  });

  if (!parsed.success) {
    trace.stages.push({ name: 'validate', ok: false, detail: 'schema_fallback' });
    return buildFallbackInsightCards(snapshot);
  }

  return parsed.data;
}

export async function runSummaryInsightOrchestration(
  model: any | null,
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  currencyHint: string,
): Promise<InsightOrchestrationResult> {
  const trace: InsightOrchestratorTrace = {
    stages: [],
    modelId: model ? MAIN_MODEL_ID : null,
  };

  const snapshot = buildInsightMetricSnapshot(transactions, categoryMap, currencyHint);
  const inputHash = await sha256Hex(stableSnapshotString(snapshot));

  if (!model) {
    trace.stages.push({ name: 'highlight_selector', ok: false, detail: 'no_model' });
    const result = buildFallbackInsightCards(snapshot);
    return { ok: true, inputHash, snapshot, result, trace };
  }

  const highlightsOut = await highlightSelectorSubAgent(model, snapshot);
  if (!highlightsOut?.highlights?.length) {
    trace.stages.push({ name: 'highlight_selector', ok: false, detail: 'failed_or_empty' });
    const result = buildFallbackInsightCards(snapshot);
    return { ok: true, inputHash, snapshot, result, trace };
  }
  trace.stages.push({ name: 'highlight_selector', ok: true });

  const result = await highlightsToCards(model, snapshot, highlightsOut.highlights, trace);

  return {
    ok: true,
    inputHash,
    snapshot,
    result: {
      ...result,
      trace: {
        highlight_metric_keys: highlightsOut.highlights.map((h) => h.metric_key),
      },
    },
    trace,
  };
}
