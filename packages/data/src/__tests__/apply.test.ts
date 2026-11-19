import type { Observable } from '@legendapp/state';
import { applyToTables, type MemoryTables, type RowWrites, type SyncedTable } from '@repo/core';
import { describe, expect, it } from 'vitest';

import { applyWrites } from '../apply';
import { memoryPersist } from '../persist';
import { createMoniStore } from '../store';
import { fakeSupabase } from './fake-supabase';

const AT = '2026-10-14T03:00:00.000Z';

/** Each applier must leave the tables exactly as this says. */
const CONTRACT: { name: string; before: MemoryTables; writes: RowWrites; after: MemoryTables | string }[] = [
  {
    name: 'a debt, its activity and the cash, then the debt’s status in the same batch',
    before: {},
    writes: {
      insert: [
        { table: 'debts', row: { id: 'd1', user_id: 'u1', counterparty_name: 'Aina', direction: 'owed_to_me', currency: 'MYR', status: 'open' } },
        { table: 'transactions', row: { id: 't1', user_id: 'u1', wallet_id: 'w1', amount: '10.00', currency: 'MYR', type: 'expense' } },
      ],
      patch: [{ table: 'debts', id: 'd1', patch: { status: 'settled', updated_at: AT } }],
      softDelete: [],
    },
    after: {
      debts: { d1: { id: 'd1', user_id: 'u1', counterparty_name: 'Aina', direction: 'owed_to_me', currency: 'MYR', status: 'settled', updated_at: AT } },
      transactions: { t1: { id: 't1', user_id: 'u1', wallet_id: 'w1', amount: '10.00', currency: 'MYR', type: 'expense' } },
    },
  },
  {
    name: 'a wallet and its transactions soft-deleted',
    before: {
      wallets: { w1: { id: 'w1', name: 'Cash', deleted: false } },
      transactions: { t1: { id: 't1', wallet_id: 'w1', deleted: false } },
    },
    writes: {
      insert: [],
      patch: [],
      softDelete: [
        { table: 'transactions', id: 't1', at: AT },
        { table: 'wallets', id: 'w1', at: AT },
      ],
    },
    after: {
      wallets: { w1: { id: 'w1', name: 'Cash', deleted: true, updated_at: AT } },
      transactions: { t1: { id: 't1', wallet_id: 'w1', deleted: true, updated_at: AT } },
    },
  },
  {
    name: 'nothing, when one patch has no live row',
    before: { wallets: { w1: { id: 'w1', name: 'Cash', deleted: true } } },
    writes: {
      insert: [{ table: 'debts', row: { id: 'd2', user_id: 'u1', counterparty_name: 'Ravi', direction: 'i_owe', currency: 'MYR' } }],
      patch: [{ table: 'wallets', id: 'w1', patch: { name: 'Purse' } }],
      softDelete: [],
    },
    after: 'Cannot patch missing row: w1',
  },
];

const TABLES: SyncedTable[] = ['wallets', 'transactions', 'debts'];

function withLegend(before: MemoryTables, writes: RowWrites): MemoryTables {
  const { supabase } = fakeSupabase();
  const store = createMoniStore({ supabase, persist: memoryPersist(), uuid: () => 'unused' });
  // Legend keeps the object it is given, so the store gets its own copy of the starting rows.
  for (const table of TABLES) {
    const rows$ = store.tables[table] as unknown as Observable<MemoryTables[SyncedTable]>;
    rows$.set(structuredClone(before[table] ?? {}));
  }
  applyWrites(store, writes);
  return Object.fromEntries(
    TABLES.map((table) => [table, store.tables[table].peek() as Record<string, Record<string, unknown>>]).filter(
      ([, rows]) => Object.keys(rows as object).length,
    ),
  );
}

const APPLIERS = { legend: withLegend, memory: applyToTables };

describe.each(Object.entries(APPLIERS))('the %s applier', (_name, apply) => {
  it.each(CONTRACT)('writes $name', ({ before, writes, after }) => {
    if (typeof after === 'string') {
      expect(() => apply(before, writes)).toThrow(after);
      return;
    }
    expect(apply(before, writes)).toEqual(after);
  });

  it('leaves the tables as they were when it refuses', () => {
    const before = { wallets: { w1: { id: 'w1', name: 'Cash', deleted: false } } };
    const refused: RowWrites = {
      insert: [],
      patch: [
        { table: 'wallets', id: 'w1', patch: { name: 'Purse' } },
        { table: 'wallets', id: 'gone', patch: { name: 'x' } },
      ],
      softDelete: [],
    };
    expect(() => apply(before, refused)).toThrow('Cannot patch missing row: gone');
    expect(before).toEqual({ wallets: { w1: { id: 'w1', name: 'Cash', deleted: false } } });
  });
});
