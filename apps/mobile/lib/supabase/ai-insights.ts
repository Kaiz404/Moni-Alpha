import { randomUUID } from 'expo-crypto';
import type { AiInsightResult } from '@repo/types';
import { aiInsightResultSchema } from '@repo/types';
import { aiInsights$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';

export const AI_INSIGHT_FEATURE_SUMMARY = 'summary_insight_cards' as const;
export const AI_INSIGHT_FEATURE_BUDGET_COACH = 'budget_coach_cards' as const;
export const AI_INSIGHT_FEATURE_MONI_FINANCE_ASSISTANT = 'moni_finance_assistant' as const;
export const AI_INSIGHT_CONTEXT_GLOBAL = 'global' as const;
export const AI_INSIGHT_SCHEMA_VERSION = 1;

export type AiInsightRow = {
  id: string;
  userId: string;
  featureKey: string;
  contextKey: string;
  schemaVersion: number;
  inputHash: string;
  status: 'pending' | 'ready' | 'error';
  toolSnapshot: unknown | null;
  result: AiInsightResult | null;
  errorMessage: string | null;
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
};

type InsightDbRow = {
  id: string;
  user_id: string | null;
  feature_key: string | null;
  context_key: string | null;
  schema_version: number | null;
  input_hash: string | null;
  status: string | null;
  tool_snapshot: string | Record<string, unknown> | null;
  result: string | Record<string, unknown> | null;
  error_message: string | null;
  model_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted?: boolean;
};

function parseJson<T>(raw: string | Record<string, unknown> | null | undefined): T | null {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as T;
  if (raw === '') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function parseAiInsightResult(
  raw: string | Record<string, unknown> | null | undefined,
): AiInsightResult | null {
  const j = parseJson<unknown>(raw);
  if (!j || typeof j !== 'object') return null;
  const r = aiInsightResultSchema.safeParse(j);
  return r.success ? r.data : null;
}

function rowToInsight(row: InsightDbRow): AiInsightRow {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    featureKey: row.feature_key ?? '',
    contextKey: row.context_key ?? '',
    schemaVersion: row.schema_version ?? AI_INSIGHT_SCHEMA_VERSION,
    inputHash: row.input_hash ?? '',
    status: (row.status as AiInsightRow['status']) ?? 'error',
    toolSnapshot: parseJson(row.tool_snapshot),
    result: parseAiInsightResult(row.result),
    errorMessage: row.error_message,
    modelId: row.model_id,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

export async function getAiInsightSlot(
  featureKey: string,
  contextKey: string,
): Promise<AiInsightRow | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const row = getRecordValues<InsightDbRow>(aiInsights$).find(
    (r) => r.user_id === userId && r.feature_key === featureKey && r.context_key === contextKey,
  );
  return row ? rowToInsight(row) : null;
}

export async function upsertAiInsight(args: {
  featureKey: string;
  contextKey: string;
  inputHash: string;
  status: 'ready' | 'error';
  toolSnapshot: unknown;
  result: AiInsightResult | null;
  errorMessage?: string | null;
  modelId: string | null;
}): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const existing = getRecordValues<InsightDbRow>(aiInsights$).find(
    (r) =>
      r.user_id === userId &&
      r.feature_key === args.featureKey &&
      r.context_key === args.contextKey,
  );

  const payload = {
    user_id: userId,
    feature_key: args.featureKey,
    context_key: args.contextKey,
    schema_version: AI_INSIGHT_SCHEMA_VERSION,
    input_hash: args.inputHash,
    status: args.status,
    tool_snapshot: args.toolSnapshot ?? null,
    result: args.result ?? null,
    error_message: args.errorMessage ?? null,
    model_id: args.modelId,
    deleted: false,
  };

  if (existing?.id) {
    patchRow(aiInsights$, existing.id, {
      ...payload,
      updated_at: now,
    });
    return;
  }

  const id = randomUUID();
  aiInsights$[id].set({
    id,
    ...payload,
  });
}
