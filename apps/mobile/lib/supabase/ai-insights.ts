import { randomUUID } from 'expo-crypto';
import type { SummaryInsightCardsV1 } from '@repo/types';
import type { InsightMetricSnapshot } from '@/lib/ai/insights/insight-metrics';
import { syncSystem } from '@/lib/powersync/Powersync';

export const AI_INSIGHT_FEATURE_SUMMARY = 'summary_insight_cards' as const;
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
  toolSnapshot: InsightMetricSnapshot | null;
  result: SummaryInsightCardsV1 | null;
  errorMessage: string | null;
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseJson<T>(raw: string | null | undefined): T | null {
  if (raw == null || raw === '') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function rowToInsight(row: {
  id: string;
  user_id: string | null;
  feature_key: string | null;
  context_key: string | null;
  schema_version: number | null;
  input_hash: string | null;
  status: string | null;
  tool_snapshot: string | null;
  result: string | null;
  error_message: string | null;
  model_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}): AiInsightRow {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    featureKey: row.feature_key ?? '',
    contextKey: row.context_key ?? '',
    schemaVersion: row.schema_version ?? AI_INSIGHT_SCHEMA_VERSION,
    inputHash: row.input_hash ?? '',
    status: (row.status as AiInsightRow['status']) ?? 'error',
    toolSnapshot: parseJson<InsightMetricSnapshot>(row.tool_snapshot),
    result: parseJson<SummaryInsightCardsV1>(row.result),
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
  const { db, supabaseConnector } = syncSystem;
  const userId = await supabaseConnector.getUserId();
  if (!userId) return null;

  const row = await db
    .selectFrom('ai_insights')
    .selectAll()
    .where('user_id', '=', userId)
    .where('feature_key', '=', featureKey)
    .where('context_key', '=', contextKey)
    .executeTakeFirst();
  return row ? rowToInsight(row as any) : null;
}

export async function upsertSummaryInsightCards(args: {
  inputHash: string;
  status: 'ready' | 'error';
  toolSnapshot: InsightMetricSnapshot;
  result: SummaryInsightCardsV1 | null;
  errorMessage?: string | null;
  modelId: string | null;
}): Promise<void> {
  const { db, supabaseConnector } = syncSystem;
  const userId = await supabaseConnector.getUserId();
  if (!userId) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const featureKey = AI_INSIGHT_FEATURE_SUMMARY;
  const contextKey = AI_INSIGHT_CONTEXT_GLOBAL;

  const existing = await db
    .selectFrom('ai_insights')
    .select(['id'])
    .where('user_id', '=', userId)
    .where('feature_key', '=', featureKey)
    .where('context_key', '=', contextKey)
    .executeTakeFirst();

  const payload = {
    user_id: userId,
    feature_key: featureKey,
    context_key: contextKey,
    schema_version: AI_INSIGHT_SCHEMA_VERSION,
    input_hash: args.inputHash,
    status: args.status,
    tool_snapshot: JSON.stringify(args.toolSnapshot),
    result: args.result ? JSON.stringify(args.result) : null,
    error_message: args.errorMessage ?? null,
    model_id: args.modelId,
    updated_at: now,
  };

  if (existing?.id) {
    await db
      .updateTable('ai_insights')
      .set(payload)
      .where('id', '=', existing.id)
      .execute();
    return;
  }

  await db
    .insertInto('ai_insights')
    .values({
      id: randomUUID(),
      ...payload,
      created_at: now,
    })
    .execute();
}
