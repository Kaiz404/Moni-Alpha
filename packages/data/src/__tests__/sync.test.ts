import { observe } from '@legendapp/state';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { memoryPersist } from '../persist';
import { createMoniStore } from '../store';
import { fakeSupabase } from './fake-supabase';

const { server, supabase } = fakeSupabase();
const persist = memoryPersist();
const store = createMoniStore({ supabase, persist, uuid: () => 'generated-id' });

const RULE = {
  id: 'rule-1',
  user_id: 'user-1',
  merchant_key: 'grab',
  source_app: 'com.maybank2u.life',
  wallet_id: 'w1',
  category_id: 'c1',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
  deleted: false,
};

const callsFor = (table: string) =>
  server.calls.filter((call) => call.split(' ')[1] === table).map((call) => call.split(' ').slice(0, 2).join(' '));
const row = (id: string) => ({
  id,
  user_id: 'user-1',
  wallet_id: 'w1',
  amount: 12,
  currency: 'MYR',
  type: 'expense' as const,
  deleted: false,
});
const transaction$ = (id: string) => store.transactions$[id]!;

async function settle() {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
}

async function eventually(check: () => boolean, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (!check() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
}

beforeAll(() => {
  store.all.forEach((obs$) => observe(() => obs$.get()));
  store.authReady$.set(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a synced table whose migration is not on the server yet', () => {
  it('stays quiet until a probe finds the table, then syncs it', async () => {
    const errors = vi.spyOn(console, 'error');
    for (const table of ['wallets', 'transactions', 'proposed_transactions']) server.tables.set(table, []);
    await store.enableStoreSync({ fullReset: true });
    await settle();

    expect(callsFor('auto_add_rules')).toEqual(['probe auto_add_rules']);
    expect(callsFor('merchant_aliases')).toEqual(['probe merchant_aliases']);
    expect(server.calls).toContain('list wallets 0-999');
    expect(store.wallets$.peek()).toEqual({});
    expect(errors).not.toHaveBeenCalled();
    expect(() => store.assertMigrated('review_later_and_auto_add_rules')).toThrow('needs a server update');
    expect(store.isMigrated('review_later_and_auto_add_rules')).toBe(false);

    server.tables.set('auto_add_rules', [RULE]);
    server.calls.length = 0;
    await store.enableStoreSync({ fullReset: true });
    await settle();
    expect(store.isMigrated('review_later_and_auto_add_rules')).toBe(true);
    store.autoAddRules$['rule-2']!.set({ ...RULE, id: 'rule-2', created_at: undefined, updated_at: undefined });
    await settle();

    const ruleCalls = callsFor('auto_add_rules');
    expect(new Set(ruleCalls)).toEqual(
      new Set(['probe auto_add_rules', 'subscribe auto_add_rules', 'list auto_add_rules', 'insert auto_add_rules']),
    );
    expect(ruleCalls[0]).toBe('probe auto_add_rules');
    expect(ruleCalls.at(-1)).toBe('insert auto_add_rules');
    expect(callsFor('merchant_aliases')).toEqual(['probe merchant_aliases']);
    expect(server.tables.get('auto_add_rules')?.map((rule) => rule.id)).toEqual(['rule-1', 'rule-2']);

    server.calls.length = 0;
    await store.enableStoreSync({ fullReset: true });
    await settle();
    expect(server.calls).not.toContain('probe auto_add_rules');
    expect(errors).not.toHaveBeenCalled();
  });
});

describe('a write', () => {
  it('is tried again once the network is back, and a refused one only once', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.tables.set('transactions', []);
    await store.enableStoreSync({ fullReset: true });
    server.calls.length = 0;
    server.offline = true;
    transaction$('offline-row').set(row('offline-row'));
    await settle();
    expect(callsFor('transactions')).toEqual(['insert transactions']);

    server.offline = false;
    await eventually(() => server.tables.get('transactions')?.length === 1);
    expect(server.tables.get('transactions')?.map((saved) => saved.id)).toEqual(['offline-row']);

    server.tables.delete('transactions');
    server.calls.length = 0;
    transaction$('refused-once').set(row('refused-once'));
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    expect(callsFor('transactions')).toEqual(['insert transactions']);
  });

  it('brings back a row the server holds soft-deleted under the same id', async () => {
    server.tables.set('transactions', []);
    await store.enableStoreSync({ fullReset: true });
    server.tables.set('transactions', [{ ...row('restored'), amount: 5, deleted: true }]);
    transaction$('restored').set(row('restored'));
    await settle();
    expect(server.tables.get('transactions')).toEqual([row('restored')]);
  });

  it('adopts the live row when a create meets one under the same id', async () => {
    const live = { ...row('live'), amount: 30, deleted: false };
    server.tables.set('transactions', [live]);
    transaction$('live').set(row('live'));
    await settle();
    expect(server.tables.get('transactions')).toEqual([live]);
  });
});

describe('signing out', () => {
  it('runs the platform clean-up, empties every table and ends the session', async () => {
    const order: string[] = [];
    vi.spyOn(supabase.auth, 'signOut').mockImplementation(async () => {
      order.push('signOut');
      return { error: null };
    });
    transaction$('kept-until-sign-out').set(row('kept-until-sign-out'));
    persist.flags.set('table-found:auto_add_rules', true);

    await store.signOutEverywhere({
      beforeClear: () => void order.push(`before ${store.authReady$.peek()}`),
      afterClear: () => void order.push(`after ${Object.keys(store.transactions$.peek() ?? {}).length}`),
    });

    expect(order).toEqual(['before false', 'after 0', 'signOut']);
    expect(persist.flags.getBoolean('table-found:auto_add_rules')).toBeUndefined();
  });
});
