import { observe, syncState } from '@legendapp/state';
import { isLiveRow } from '@repo/core';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { memoryPersist } from '../persist';
import { createMoniStore } from '../store';
import { fakeSupabase } from './fake-supabase';

type Row = Record<string, unknown>;

const { server, supabase } = fakeSupabase();
const store = createMoniStore({ supabase, persist: memoryPersist(), uuid: () => 'generated-id' });

const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const stamp = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString();
const transaction = (n: number, over: Row = {}): Row => ({
  id: id(n),
  user_id: 'user-1',
  wallet_id: 'w1',
  amount: '10.00',
  currency: 'MYR',
  type: 'expense',
  transaction_date: stamp(n),
  created_at: stamp(n),
  updated_at: stamp(n),
  deleted: false,
  ...over,
});
const rows = (count: number, start = 0) => Array.from({ length: count }, (_, index) => transaction(start + index));

const heldIds = () =>
  Object.values(store.transactions$.peek() ?? {})
    .filter(isLiveRow)
    .map((row) => row.id)
    .sort();
const pullsOfTransactions = () =>
  server.calls.filter((call) => call.startsWith('list transactions')).map((call) => call.slice(5));

async function settle() {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
}

async function launch() {
  server.calls.length = 0;
  server.failOnRequest = null;
  await store.enableStoreSync({ fullReset: true });
  await settle();
}

beforeAll(() => {
  store.all.forEach((obs$) => observe(() => obs$.get()));
  store.authReady$.set(true);
});

beforeEach(() => {
  server.tables.clear();
  server.maxRows = 1000;
  server.requests = 0;
});

describe('pulling a table larger than the server returns in one response', () => {
  it('holds all 2,500 rows when the server cuts responses at 1,000', async () => {
    server.tables.set('transactions', rows(2500));
    await launch();
    expect(heldIds()).toHaveLength(2500);
    expect(heldIds()[2499]).toBe(id(2499));
  });

  it('holds every row when the server cuts responses below the page size', async () => {
    server.maxRows = 400;
    server.tables.set('transactions', rows(1000));
    await launch();
    expect(heldIds()).toHaveLength(1000);
  });

  it('asks for pages from where the last one stopped, ending on an empty page', async () => {
    server.tables.set('transactions', rows(2500));
    await launch();
    expect(pullsOfTransactions()).toEqual([
      'transactions 0-999',
      'transactions 1000-1999',
      'transactions 2000-2999',
      'transactions 2500-3499',
    ]);
  });

  it('removes a row soft-deleted past the first page, and keeps the rest', async () => {
    server.tables.set('transactions', [...rows(1500), transaction(1500, { deleted: true }), transaction(1501)]);
    await launch();
    expect(heldIds()).toHaveLength(1501);
    expect(heldIds()).not.toContain(id(1500));
    expect(heldIds()).toContain(id(1501));
  });

  it('pulls only what changed since the last pull, across pages', async () => {
    server.tables.set('transactions', rows(1200));
    await launch();
    server.tables.set('transactions', [...rows(1200), ...rows(1100, 5000)]);
    server.calls.length = 0;
    await syncState(store.transactions$).get().sync?.();
    await settle();
    expect(heldIds()).toHaveLength(2300);
    expect(pullsOfTransactions()).toEqual([
      'transactions 0-999',
      'transactions 1000-1999',
      'transactions 1100-2099',
    ]);
  });

  it('keeps what the device holds when a later page fails offline, then pulls again', async () => {
    server.tables.set('transactions', rows(1500));
    await launch();
    expect(heldIds()).toHaveLength(1500);
    server.tables.set('transactions', rows(2500));
    server.requests = 0;
    server.failOnRequest = 2;
    await syncState(store.transactions$).get().sync?.();
    await settle();
    expect(heldIds()).toHaveLength(1500);

    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await settle();
    expect(heldIds()).toHaveLength(2500);
  });
});
