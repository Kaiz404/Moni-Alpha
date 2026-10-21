import { randomUUID } from 'expo-crypto';
import {
  createAutoAddRuleInputSchema,
  type AutoAddRule,
  type CreateAutoAddRuleInput,
} from '@repo/types';
import { assertMigrated, autoAddRules$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';

export type AutoAddRuleRow = {
  id: string;
  user_id: string | null;
  merchant_key: string | null;
  source_app: string | null;
  wallet_id: string | null;
  category_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted?: boolean;
};

const ruleKey = (sourceApp: string, merchantKey: string) => `${sourceApp}|${merchantKey}`;

function rowToRule(row: AutoAddRuleRow): AutoAddRule {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    merchantKey: row.merchant_key ?? '',
    sourceApp: row.source_app ?? '',
    walletId: row.wallet_id ?? '',
    categoryId: row.category_id ?? '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? row.created_at ?? '',
    deleted: row.deleted === true,
  };
}

/** Offline devices can each write a rule for the same app and merchant. */
function latestRulePerAppAndMerchant(
  rows: readonly AutoAddRuleRow[],
  userId: string,
): AutoAddRule[] {
  const latest = new Map<string, AutoAddRule>();
  for (const row of rows) {
    if (row.user_id !== userId || row.deleted) continue;
    if (!row.merchant_key || !row.source_app || !row.wallet_id || !row.category_id) continue;
    const rule = rowToRule(row);
    const key = ruleKey(rule.sourceApp, rule.merchantKey);
    const current = latest.get(key);
    if (!current || rule.updatedAt > current.updatedAt) latest.set(key, rule);
  }
  return [...latest.values()];
}

export function listAutoAddRules(userId: string): AutoAddRule[] {
  return latestRulePerAppAndMerchant(getRecordValues<AutoAddRuleRow>(autoAddRules$), userId);
}

export async function createAutoAddRule(input: CreateAutoAddRuleInput): Promise<void> {
  assertMigrated('review_later_and_auto_add_rules');
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const data = createAutoAddRuleInputSchema.parse(input);
  const fields = {
    merchant_key: data.merchantKey,
    source_app: data.sourceApp,
    wallet_id: data.walletId,
    category_id: data.categoryId,
  };

  const existing = Object.values(
    (autoAddRules$.peek() ?? {}) as Record<string, AutoAddRuleRow | undefined>,
  ).find(
    (row) =>
      row?.user_id === userId &&
      row.source_app === data.sourceApp &&
      row.merchant_key === data.merchantKey,
  );
  if (existing) {
    autoAddRules$[existing.id].set({
      ...existing,
      ...fields,
      deleted: false,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const id = randomUUID();
  autoAddRules$[id].set({ id, user_id: userId, ...fields, deleted: false });
}

export function deleteAutoAddRule(id: string): void {
  patchRow(autoAddRules$, id, { deleted: true, updated_at: new Date().toISOString() });
}
