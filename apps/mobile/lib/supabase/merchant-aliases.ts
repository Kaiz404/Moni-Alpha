import { randomUUID } from 'expo-crypto';
import { merchantAliasSchema, type MerchantAlias } from '@repo/types';
import { assertTableMigrated, merchantAliases$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';

export type MerchantAliasRow = {
  id: string;
  user_id: string | null;
  raw_key: string | null;
  display_name: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted?: boolean;
};

/** One name per merchant key: offline devices can each write one, so the latest update wins. */
export function selectMerchantAliases(
  rows: readonly MerchantAliasRow[],
  userId: string,
): MerchantAlias[] {
  const latest = new Map<string, MerchantAlias>();
  for (const row of rows) {
    if (row.user_id !== userId || row.deleted || !row.raw_key || !row.display_name) continue;
    const alias: MerchantAlias = {
      id: row.id,
      userId: row.user_id,
      rawKey: row.raw_key,
      displayName: row.display_name,
      createdAt: row.created_at ?? '',
      updatedAt: row.updated_at ?? row.created_at ?? '',
      deleted: false,
    };
    const current = latest.get(alias.rawKey);
    if (!current || alias.updatedAt > current.updatedAt) latest.set(alias.rawKey, alias);
  }
  return [...latest.values()];
}

export function listMerchantAliases(userId: string): MerchantAlias[] {
  return selectMerchantAliases(getRecordValues<MerchantAliasRow>(merchantAliases$), userId);
}

/** Names every merchant with this key; naming it again renames this device's row. */
export async function nameMerchant(rawKey: string, displayName: string): Promise<void> {
  assertTableMigrated('merchant_aliases');
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const data = merchantAliasSchema.pick({ rawKey: true, displayName: true }).parse({
    rawKey,
    displayName,
  });

  const existing = Object.values(
    (merchantAliases$.peek() ?? {}) as Record<string, MerchantAliasRow | undefined>,
  ).find((row) => row?.user_id === userId && row.raw_key === data.rawKey);
  if (existing) {
    merchantAliases$[existing.id].set({
      ...existing,
      display_name: data.displayName,
      deleted: false,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const id = randomUUID();
  merchantAliases$[id].set({
    id,
    user_id: userId,
    raw_key: data.rawKey,
    display_name: data.displayName,
    deleted: false,
  });
}
