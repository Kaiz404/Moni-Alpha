import { liveAutoAddRules, type StoredRow } from '@repo/core';
import { randomUUID } from 'expo-crypto';
import {
  createAutoAddRuleInputSchema,
  type AutoAddRule,
  type CreateAutoAddRuleInput,
} from '@repo/types';
import { assertMigrated, autoAddRules$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';

export type AutoAddRuleRow = StoredRow<'auto_add_rules'>;

export function listAutoAddRules(userId: string): AutoAddRule[] {
  return liveAutoAddRules(getRecordValues<AutoAddRuleRow>(autoAddRules$), userId);
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
