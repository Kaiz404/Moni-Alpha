import { observe } from '@legendapp/state';
import { SYNCED_TABLES, type RowWrites } from '@repo/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';

import { applyWrites } from '../apply';
import { memoryPersist } from '../persist';
import { createMoniStore, type MoniStore } from '../store';
import { fakeSupabase } from './fake-supabase';

type Row = Record<string, unknown>;

const stores: MoniStore[] = [];

afterEach(async () => {
  for (const store of stores.splice(0)) await store.clearStore();
});

/**
 * A signed-in store over a server that stamps its own times, with every table pulled. `latency` says
 * how long each request takes to land, by its call and how many of that call went before it.
 */
async function mount(
  seed: Partial<Record<string, Row[]>>,
  latency: (call: string, nth: number) => number,
  { serverAheadMs = 0, realtimeLag = 0 } = {},
) {
  const { server, supabase } = fakeSupabase();
  for (const table of SYNCED_TABLES) server.tables.set(table, (seed[table] ?? []).map((row) => ({ ...row })));
  server.clock = () => new Date(Date.now() + serverAheadMs).toISOString();
  server.realtimeLag = realtimeLag;
  server.foreignKeys.set('proposed_transactions.transaction_id', 'transactions');
  const store = createMoniStore({ supabase, persist: memoryPersist(), uuid: () => crypto.randomUUID() });
  stores.push(store);
  store.all.forEach((obs$) => observe(() => obs$.get()));
  store.authReady$.set(true);
  await store.enableStoreSync({ fullReset: true });
  const sent = new Map<string, number>();
  server.latency = (call) => {
    const nth = sent.get(call) ?? 0;
    sent.set(call, nth + 1);
    return latency(call, nth);
  };
  return { server, store };
}

const write = (store: MoniStore, writes: Partial<RowWrites>) =>
  applyWrites(store, { insert: [], patch: [], softDelete: [], ...writes } as RowWrites);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => new Date().toISOString();

function serverRow(server: ReturnType<typeof fakeSupabase>['server'], table: string, id: string) {
  return server.tables.get(table)?.find((row) => row.id === id);
}

const EXPENSE = { id: 'tx-1', user_id: 'user-1', wallet_id: 'w1', amount: '12.50', currency: 'MYR', type: 'expense', merchant: 'Kopitiam', deleted: false };
const STORED = { ...EXPENSE, category_id: 'food', created_at: '2026-11-01T00:00:00.000Z', updated_at: '2026-11-01T00:00:00.000Z' };
const PROPOSAL = {
  id: 'p-1',
  user_id: 'user-1',
  status: 'pending',
  reviewed_at: null,
  transaction_id: null,
  deleted: false,
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
};

/** The device's clock against the server's, and how late the change feed runs. */
const CLOCKS = [
  ['clocks agreeing', {}],
  ['a server clock ahead and a late change feed', { serverAheadMs: 5_000, realtimeLag: 300 }],
  ['a server clock behind and a late change feed', { serverAheadMs: -5_000, realtimeLag: 300 }],
  ['a server clock weeks ahead and a prompt change feed', { serverAheadMs: 40 * 86_400_000 }],
] as const;

const slower = (call: string, nth: number) => (call.startsWith('update') || call.startsWith('insert') ? 400 - nth * 150 : 0);
const faster = (call: string, nth: number) => (call.startsWith('update') || call.startsWith('insert') ? 20 + nth * 150 : 0);

describe.each(CLOCKS)("a row's writes made a moment apart, with %s", (_, clocks) => {
  it('Add then Undo: the soft delete lands after the insert, so the row stays deleted', async () => {
    const { server, store } = await mount({}, (call) => (call === 'insert transactions' ? 300 : 20), clocks);

    write(store, { insert: [{ table: 'transactions', row: { ...EXPENSE } as never }] });
    await wait(50);
    write(store, { softDelete: [{ table: 'transactions', id: 'tx-1', at: now() }] });
    await wait(1_000);

    expect(serverRow(server, 'transactions', 'tx-1')?.deleted).toBe(true);
    expect(store.transactions$['tx-1']!.deleted.peek() ?? 'gone').not.toBe(false);
  });

  it('a change then its Undo: the server keeps the undone value even when the change is slower', async () => {
    const { server, store } = await mount({ transactions: [STORED] }, (call, nth) => (call === 'update transactions' && nth === 0 ? 300 : 20), clocks);

    write(store, { patch: [{ table: 'transactions', id: 'tx-1', patch: { category_id: 'transport', updated_at: now() } }] });
    await wait(50);
    write(store, { patch: [{ table: 'transactions', id: 'tx-1', patch: { category_id: 'food', updated_at: now() } }] });
    await wait(1_000);

    expect(serverRow(server, 'transactions', 'tx-1')?.category_id).toBe('food');
    expect(store.transactions$['tx-1']!.category_id.peek()).toBe('food');
  });

  it.each([
    ['each write slower than the next', slower],
    ['each write faster than the next', faster],
  ])('approve, undo, approve again on one capture, %s, ends approved with the second ledger row', async (_, latency) => {
    const { server, store } = await mount({ proposed_transactions: [PROPOSAL] }, latency, clocks);
    const approve = (transactionId: string) => {
      const at = now();
      write(store, {
        insert: [{ table: 'transactions', row: { ...EXPENSE, id: transactionId } as never }],
        patch: [{ table: 'proposed_transactions', id: 'p-1', patch: { status: 'approved', reviewed_at: at, transaction_id: transactionId, updated_at: at } }],
      });
    };

    approve('tx-1');
    await wait(50);
    write(store, {
      patch: [{ table: 'proposed_transactions', id: 'p-1', patch: { status: 'pending', reviewed_at: null, transaction_id: null, updated_at: now() } }],
      softDelete: [{ table: 'transactions', id: 'tx-1', at: now() }],
    });
    await wait(50);
    approve('tx-2');
    await wait(2_000);

    expect(serverRow(server, 'proposed_transactions', 'p-1')).toMatchObject({ status: 'approved', transaction_id: 'tx-2' });
    expect(serverRow(server, 'transactions', 'tx-1')?.deleted).toBe(true);
    expect(serverRow(server, 'transactions', 'tx-2')?.deleted).toBe(false);
    expect(store.proposedTransactions$['p-1']!.peek()).toMatchObject({ status: 'approved', transaction_id: 'tx-2' });
    expect(store.transactions$['tx-1']!.deleted.peek() ?? 'gone').not.toBe(false);
  });
});

describe('a write that points at a row made in the same change', () => {
  it('waits for that row to land: an approve whose ledger row is slow keeps the capture approved', async () => {
    const { server, store } = await mount({ proposed_transactions: [PROPOSAL] }, (call) => (call === 'insert transactions' ? 300 : 20));
    const at = now();

    write(store, {
      insert: [{ table: 'transactions', row: { ...EXPENSE } as never }],
      patch: [{ table: 'proposed_transactions', id: 'p-1', patch: { status: 'approved', reviewed_at: at, transaction_id: 'tx-1', updated_at: at } }],
    });
    await wait(1_000);

    expect(serverRow(server, 'proposed_transactions', 'p-1')).toMatchObject({ status: 'approved', transaction_id: 'tx-1' });
    expect(serverRow(server, 'transactions', 'tx-1')?.deleted).toBe(false);
  });

  it('keeps waiting while that row is retried: an insert lost once to the network still leaves the capture approved', async () => {
    const { server, store } = await mount({ proposed_transactions: [PROPOSAL] }, () => 20);
    server.fail = (call, nth) => (call === 'insert transactions' && nth === 0 ? { message: 'TypeError: Failed to fetch' } : null);
    const at = now();

    write(store, {
      insert: [{ table: 'transactions', row: { ...EXPENSE } as never }],
      patch: [{ table: 'proposed_transactions', id: 'p-1', patch: { status: 'approved', reviewed_at: at, transaction_id: 'tx-1', updated_at: at } }],
    });
    await wait(3_500);

    expect(server.calls.filter((call) => /^(insert|update) /.test(call))).toEqual([
      'insert transactions',
      'insert transactions',
      'update proposed_transactions',
    ]);
    expect(serverRow(server, 'proposed_transactions', 'p-1')).toMatchObject({ status: 'approved', transaction_id: 'tx-1' });
  });

  it('two new rows that point at each other both land', async () => {
    const { server, store } = await mount({}, () => 20);

    write(store, {
      insert: [
        { table: 'transactions', row: { ...EXPENSE, id: 'out', linked_transaction_id: 'in' } as never },
        { table: 'transactions', row: { ...EXPENSE, id: 'in', linked_transaction_id: 'out' } as never },
      ],
    });
    await wait(500);

    expect(server.tables.get('transactions')?.map((row) => row.id).sort()).toEqual(['in', 'out']);
  });
});

describe('the change feed', () => {
  it("brings another device's change, also to a row this device just wrote", async () => {
    const { server, store } = await mount({ transactions: [STORED, { ...STORED, id: 'tx-2' }] }, () => 20);
    const otherDevice = (id: string, patch: Row) =>
      (store.supabase as unknown as SupabaseClient).from('transactions').update(patch).eq('id', id);

    write(store, { patch: [{ table: 'transactions', id: 'tx-1', patch: { category_id: 'transport', updated_at: now() } }] });
    await wait(100);
    await otherDevice('tx-1', { category_id: 'groceries' });
    await otherDevice('tx-2', { merchant: 'Mamak Ali' });
    await wait(100);

    expect(store.transactions$['tx-1']!.category_id.peek()).toBe('groceries');
    expect(store.transactions$['tx-2']!.merchant.peek()).toBe('Mamak Ali');
    expect(serverRow(server, 'transactions', 'tx-1')?.category_id).toBe('groceries');
  });
});
