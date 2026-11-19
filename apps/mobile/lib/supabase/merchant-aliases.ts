import {
  merchantAliasesFromRows,
  planForgetMerchantNames,
  planMerchantNames,
  type MerchantAliasRow,
} from '@repo/core';
import type { MerchantAlias } from '@repo/types';
import { merchantAliases$ } from '@/lib/store';
import { commit, planContext } from '@/lib/store/writes';

export type { MerchantAliasRow };

/** Every row, soft-deleted ones too: a plan revives a forgotten name rather than adding a second row. */
function aliasRows(): MerchantAliasRow[] {
  return Object.values((merchantAliases$.peek() ?? {}) as Record<string, MerchantAliasRow | undefined>).filter(
    (row): row is MerchantAliasRow => row != null,
  );
}

export function listMerchantAliases(userId: string): MerchantAlias[] {
  return merchantAliasesFromRows(merchantAliases$.get() ?? {}, userId);
}

/** Names a code; naming it again renames it, and a forgotten name comes back on its own row. */
export async function nameMerchant(rawKey: string, displayName: string): Promise<void> {
  const ctx = await planContext();
  commit(planMerchantNames(aliasRows(), [rawKey], displayName, ctx));
}

/** "Forget this name": soft-deletes every alias for the key, including other devices' copies. */
export async function forgetMerchantName(rawKey: string): Promise<void> {
  const ctx = await planContext();
  commit(planForgetMerchantNames(aliasRows(), [rawKey], ctx));
}
