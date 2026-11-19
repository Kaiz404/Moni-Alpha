import { merchantAliasSchema } from '@repo/types';

import { planned, refused, type PlanContext, type Planned, type RowInsert, type RowPatch, type RowSoftDelete, type StoredRow } from './types';

/** A merchant name as stored, soft-deleted rows included, so naming a code again revives its row. */
export type MerchantAliasRow = StoredRow<'merchant_aliases'>;

const MIGRATION = 'merchant_aliases_and_wallet_location';
const NOT_MIGRATED = 'Moni needs a server update before it can save this. Try again later.';

const newest = (a: MerchantAliasRow, b: MerchantAliasRow) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? ''));

/**
 * Gives each code the same name: a code with a live name gets the newest of its rows renamed, a code
 * named once and forgotten gets that row back, and a new code gets a new row.
 */
export function planMerchantNames(
  rows: readonly MerchantAliasRow[],
  rawKeys: readonly string[],
  displayName: string,
  ctx: PlanContext,
): Planned<null> {
  if (!ctx.isMigrated(MIGRATION)) return refused(NOT_MIGRATED);
  const insert: RowInsert[] = [];
  const patch: RowPatch[] = [];
  for (const rawKey of new Set(rawKeys)) {
    const parsed = merchantAliasSchema.pick({ rawKey: true, displayName: true }).safeParse({ rawKey, displayName });
    if (!parsed.success) return refused(displayName.trim() ? 'That name is too long.' : 'Type a name first.');
    const mine = rows.filter((row) => row.user_id === ctx.userId && row.raw_key === rawKey).sort(newest);
    const live = mine.find((row) => !row.deleted);
    const name = parsed.data.displayName;
    if (live) {
      if (live.display_name !== name) {
        patch.push({ table: 'merchant_aliases', id: live.id, patch: { display_name: name, updated_at: ctx.now } });
      }
      continue;
    }
    const forgotten = mine[0];
    insert.push({
      table: 'merchant_aliases',
      row: forgotten
        ? { ...forgotten, display_name: name, deleted: false, updated_at: ctx.now }
        : { id: ctx.newId(), user_id: ctx.userId, raw_key: rawKey, display_name: name, deleted: false },
    });
  }
  return planned({ insert, patch }, null);
}

/** Forgets each code's name: every live row for it, other devices' copies included, is soft-deleted. */
export function planForgetMerchantNames(
  rows: readonly MerchantAliasRow[],
  rawKeys: readonly string[],
  ctx: PlanContext,
): Planned<null> {
  if (!ctx.isMigrated(MIGRATION)) return refused(NOT_MIGRATED);
  const keys = new Set(rawKeys);
  const softDelete: RowSoftDelete[] = rows
    .filter((row) => row.user_id === ctx.userId && keys.has(row.raw_key) && !row.deleted)
    .map((row) => ({ table: 'merchant_aliases', id: row.id, at: ctx.now }));
  return planned({ softDelete }, null);
}
