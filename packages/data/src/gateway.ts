import type { SyncedTable } from '@repo/core';
import { legacyColor } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { isNetworkError, type MoniSupabase } from './supabase';

export type Row = Record<string, unknown>;

/** A refusal stays one; only a request that never reached Supabase is worth trying again. */
export type Failure = { ok: false; message: string; retryable: boolean };
export type RowResult = { ok: true; row: Row | undefined } | Failure;
export type ListResult = { ok: true; rows: Row[] } | Failure;

const PULL_PAGE = 1000;

const COLOURED: ReadonlySet<SyncedTable> = new Set(['categories', 'wallets']);

/**
 * Postgres and PostgREST codes for a failure that passes: a statement timeout, a serialization or
 * deadlock abort, an expired session, and a row this one points at that is not there yet (its insert
 * is still being retried).
 */
const PASSING_CODES: ReadonlySet<string> = new Set(['57014', '40001', '40P01', 'PGRST301', 'PGRST303', '23503']);

type SupabaseError = { message: string; code?: string };

/**
 * Worth trying again: the request never got an answer, or the server failed for a reason that
 * passes. A refusal (row-level security, a check, a table the server lacks) stays one.
 */
function failure(error: SupabaseError, status?: number): Failure {
  const passing =
    isNetworkError(error.message) ||
    (status !== undefined && (status >= 500 || status === 401 || status === 408 || status === 429)) ||
    (error.code !== undefined && PASSING_CODES.has(error.code));
  return { ok: false, message: error.message, retryable: passing };
}

/**
 * A write queued offline before the palette change still carries an old hex, which the colour
 * constraint would refuse, so creates and updates send today's colour.
 */
function withCurrentColor(table: SyncedTable, row: Row): Row {
  if (!COLOURED.has(table) || !('color' in row)) return row;
  return { ...row, color: legacyColor(row.color as string | null | undefined) };
}

/**
 * Reads and writes synced rows of any table by name. The row shape belongs to the caller (the
 * store's tables, a write plan), so the gateway talks to an untyped view of the client.
 */
export function createRowGateway(client: MoniSupabase) {
  const supabase = client as unknown as SupabaseClient;

  return {
    /**
     * A pull never brings a soft-deleted row to a device, so a restore can create a row whose id the
     * server still holds. Insert as usual; on the key clash, bring a soft-deleted row back, or adopt
     * the row already live, which a create must never overwrite.
     */
    async createOrRevive(table: SyncedTable, input: Row): Promise<RowResult> {
      const row = withCurrentColor(table, input);
      const inserted = await supabase.from(table).insert(row).select();
      if (inserted.error?.code !== '23505') {
        return inserted.error ? failure(inserted.error, inserted.status) : { ok: true, row: inserted.data?.[0] };
      }
      const id = row.id as string;
      const revived = await supabase.from(table).update(row).eq('id', id).eq('deleted', true).select();
      if (revived.error) return failure(revived.error, revived.status);
      if (revived.data?.length) return { ok: true, row: revived.data[0] };
      const live = await supabase.from(table).select().eq('id', id);
      // Nothing under this id means another unique key clashed, which is a real failure.
      if (!live.data?.length) return failure(inserted.error, inserted.status);
      // The same row queued again before its insert returned (an Undo a second after Add marks it
      // deleted): a newer version wins. A create with no time or an older one, such as a re-queued
      // row from an old app version, never overwrites the server.
      const current = live.data[0] as Row;
      const at = (value: unknown) => (typeof value === 'string' ? Date.parse(value) : Number.NaN);
      const newer = !Number.isNaN(at(row.updated_at)) && (Number.isNaN(at(current.updated_at)) || at(row.updated_at) > at(current.updated_at));
      if (!newer) return { ok: true, row: current };
      const updated = await supabase.from(table).update(row).eq('id', id).select();
      return updated.error ? failure(updated.error, updated.status) : { ok: true, row: updated.data?.[0] ?? current };
    },

    async update(table: SyncedTable, input: Row): Promise<RowResult> {
      const updated = await supabase
        .from(table)
        .update(withCurrentColor(table, input))
        .eq('id', input.id as string)
        .select();
      return updated.error ? failure(updated.error, updated.status) : { ok: true, row: updated.data?.[0] };
    },

    /** Synced rows are never `DELETE`d: a device pulling by `updated_at` would never learn of it. */
    softDelete(table: SyncedTable, id: string): Promise<RowResult> {
      return this.update(table, { id, deleted: true });
    },

    /**
     * PostgREST cuts a response at the server's `max_rows` and reports no error, so one request
     * leaves a larger table short. Pages run in id order, which an edit never changes, so no row
     * moves between pages. Only an empty page ends the pull: a page shorter than asked may just
     * mean the server's cap is lower than the page size.
     */
    async list(table: SyncedTable, changedSince?: number): Promise<ListResult> {
      const rows: Row[] = [];
      while (true) {
        const query = changedSince
          ? supabase.from(table).select().gt('updated_at', new Date(changedSince).toISOString())
          : supabase.from(table).select();
        const page = await query.order('id').range(rows.length, rows.length + PULL_PAGE - 1);
        if (page.error) return failure(page.error, page.status);
        if (!page.data.length) return { ok: true, rows };
        rows.push(...page.data);
      }
    },
  };
}

export type RowGateway = ReturnType<typeof createRowGateway>;
