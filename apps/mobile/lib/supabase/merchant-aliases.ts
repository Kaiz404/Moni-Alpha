import { merchantAliasesFromRows, type StoredRow } from '@repo/core';
import { randomUUID } from 'expo-crypto';
import { merchantAliasSchema, type MerchantAlias } from '@repo/types';
import { assertMigrated, merchantAliases$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';

export type MerchantAliasRow = StoredRow<'merchant_aliases'>;

export function listMerchantAliases(userId: string): MerchantAlias[] {
  return merchantAliasesFromRows(merchantAliases$.get() ?? {}, userId);
}

export async function nameMerchant(rawKey: string, displayName: string): Promise<void> {
  assertMigrated('merchant_aliases_and_wallet_location');
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

/** "Forget this name": soft-deletes every alias for the key, including other devices' copies. */
export async function forgetMerchantName(rawKey: string): Promise<void> {
  assertMigrated('merchant_aliases_and_wallet_location');
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const updatedAt = new Date().toISOString();
  for (const row of getRecordValues<MerchantAliasRow>(merchantAliases$)) {
    if (row.user_id !== userId || row.raw_key !== rawKey) continue;
    patchRow(merchantAliases$, row.id, { deleted: true, updated_at: updatedAt });
  }
}
