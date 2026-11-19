import { observe } from '@legendapp/state';
import { authReady$, enableStoreSync, store, transactions$ } from '@/lib/store';
import { ensureStoreSync, waitForSync } from '@/lib/store/headless-sync';

type Row = Record<string, unknown>;

const mockServer = {
  tables: new Map<string, Row[]>(),
  calls: [] as string[],
  offline: false,
};

function mockQuery(table: string, op: string) {
  const rows = mockServer.tables.get(table);
  const result = mockServer.offline
    ? { data: null, error: { message: 'TypeError: Network request failed' } }
    : rows
    ? { data: op === 'probe' ? rows.slice(0, 1) : rows, error: null }
    : {
        data: null,
        error: {
          code: 'PGRST205',
          message: `Could not find the table 'public.${table}' in the schema cache`,
        },
      };
  mockServer.calls.push(`${op} ${table}`);
  let from = 0;
  const query: any = {
    gt: () => query,
    eq: () => query,
    order: () => query,
    range: (start: number) => {
      from = start;
      return query;
    },
    limit: () => {
      mockServer.calls.pop();
      return mockQuery(table, 'probe');
    },
    select: () => query,
    then: (resolve: any, reject: any) =>
      Promise.resolve(result.data ? { ...result, data: result.data.slice(from) } : result).then(
        resolve,
        reject,
      ),
  };
  return query;
}

jest.mock('@/lib/supabase/client', () => ({
  getUserId: async () => 'user-1',
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: (table: string) => ({
      select: () => mockQuery(table, 'list'),
      insert: (row: Row) => {
        if (!mockServer.offline) mockServer.tables.get(table)?.push(row);
        return mockQuery(table, 'insert');
      },
      update: () => mockQuery(table, 'update'),
    }),
    channel: () => {
      const channel: any = {
        on: (_event: string, filter: { table: string }) => {
          mockServer.calls.push(`subscribe ${filter.table}`);
          return channel;
        },
        subscribe: () => channel,
        unsubscribe: () => {},
      };
      return channel;
    },
  },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'generated-id' }));

const callsFor = (table: string) => mockServer.calls.filter((call) => call.endsWith(` ${table}`));

async function settle() {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('waiting for Supabase to accept a capture', () => {
  const row = (id: string) => ({ id, user_id: 'user-1', amount_minor: 1200, deleted: false });
  const saved = (id: string, timeoutMs = 300) =>
    waitForSync([transactions$], { rowIds: [id], timeoutMs });

  beforeAll(() => {
    store.all.forEach((obs$) => observe(() => obs$.get()));
    authReady$.set(true);
  });

  it('is true once the insert lands', async () => {
    mockServer.tables.set('transactions', []);
    await enableStoreSync({ fullReset: true });
    transactions$['accepted-row'].set(row('accepted-row'));

    expect(await saved('accepted-row', 1000)).toBe(true);
    expect(mockServer.tables.get('transactions')?.map((r) => r.id)).toEqual(['accepted-row']);
  });

  it('is false for a row a full pull dropped before it uploaded', async () => {
    mockServer.tables.set('transactions', []);
    transactions$['dropped-row'].set(row('dropped-row'));
    await enableStoreSync({ fullReset: true });

    expect(await saved('dropped-row')).toBe(false);
  });

  it('holds a headless write until the pull the app runs as it opens has finished', async () => {
    mockServer.tables.set('transactions', []);
    const opening = enableStoreSync({ fullReset: true });
    await ensureStoreSync();
    transactions$['after-open'].set(row('after-open'));
    await opening;

    expect(await saved('after-open', 1000)).toBe(true);
  });

  it('tries a write again once the network is back, and a refused one only once', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockServer.tables.set('transactions', []);
    await enableStoreSync({ fullReset: true });
    mockServer.calls.length = 0;
    mockServer.offline = true;
    transactions$['offline-row'].set(row('offline-row'));
    await settle();
    expect(callsFor('transactions')).toEqual(['insert transactions']);

    mockServer.offline = false;
    expect(await saved('offline-row', 3_000)).toBe(true);
    expect(mockServer.tables.get('transactions')?.map((r) => r.id)).toEqual(['offline-row']);

    mockServer.tables.delete('transactions');
    mockServer.calls.length = 0;
    transactions$['refused-once'].set(row('refused-once'));
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    expect(callsFor('transactions')).toEqual(['insert transactions']);
    errors.mockRestore();
  });

  it('is false while Supabase refuses the row, and other rows do not wait on it', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockServer.tables.set('transactions', []);
    await enableStoreSync({ fullReset: true });
    transactions$['accepted-row'].set(row('accepted-row'));
    expect(await saved('accepted-row', 1000)).toBe(true);
    mockServer.tables.delete('transactions');
    transactions$['refused-row'].set(row('refused-row'));
    await settle();

    expect(await saved('refused-row')).toBe(false);
    expect(await saved('accepted-row')).toBe(true);
    errors.mockRestore();
  });
});
