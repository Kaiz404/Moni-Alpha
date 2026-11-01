import { observe, syncState } from '@legendapp/state';

import { ALL_STORE_OBSERVABLES, enableStoreSync, transactions$ } from '@/lib/store';
import { authReady$ } from '@/lib/store/auth-sync';
import { getRecordValues } from '@/lib/store/helpers';

type Row = Record<string, unknown>;

/** Postgres behind PostgREST: a response stops at `maxRows` with no error, whatever was asked. */
const mockServer = {
  tables: new Map<string, Row[]>(),
  maxRows: 1000,
  failOnRequest: null as number | null,
  requests: [] as string[],
};

function mockQuery(table: string) {
  const filters: ((row: Row) => boolean)[] = [];
  let orderBy: string | null = null;
  let window: [number, number] | null = null;
  let limit: number | null = null;
  const query: any = {
    select: () => query,
    gt: (field: string, value: string) => {
      filters.push((row) => new Date(String(row[field])) > new Date(value));
      return query;
    },
    eq: (field: string, value: unknown) => {
      filters.push((row) => row[field] === value);
      return query;
    },
    order: (field: string) => {
      orderBy = field;
      return query;
    },
    range: (from: number, to: number) => {
      window = [from, to];
      return query;
    },
    limit: (count: number) => {
      limit = count;
      return query;
    },
    then: (resolve: any, reject: any) => {
      const count = mockServer.requests.push(`${table} ${window?.join('-') ?? 'all'}`);
      if (mockServer.failOnRequest === count) {
        return Promise.resolve({ data: null, error: { message: 'Network request failed' } }).then(
          resolve,
          reject,
        );
      }
      const all = (mockServer.tables.get(table) ?? []).filter((row) => filters.every((f) => f(row)));
      if (orderBy) {
        const field = orderBy;
        all.sort((a, b) => String(a[field]).localeCompare(String(b[field])));
      }
      const asked = window ? all.slice(window[0], window[1] + 1) : all;
      const data = asked.slice(0, Math.min(mockServer.maxRows, limit ?? Infinity));
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return query;
}

jest.mock('@/lib/supabase/client', () => ({
  getUserId: async () => 'user-1',
  supabase: {
    from: (table: string) => mockQuery(table),
    channel: () => {
      const channel: any = { on: () => channel, subscribe: () => channel, unsubscribe: () => {} };
      return channel;
    },
  },
}));
jest.mock('@/lib/supabase/profile', () => ({ getProfilePreferences: async () => ({}) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'generated-id' }));

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
const rows = (count: number, start = 0) =>
  Array.from({ length: count }, (_, index) => transaction(start + index));

const heldIds = () => getRecordValues<{ id: string }>(transactions$).map((row) => row.id).sort();
const pullsOfTransactions = () =>
  mockServer.requests.filter((request) => request.startsWith('transactions '));

async function settle() {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
}

async function launch() {
  mockServer.requests.length = 0;
  mockServer.failOnRequest = null;
  await enableStoreSync({ fullReset: true });
  await settle();
}

beforeAll(() => {
  ALL_STORE_OBSERVABLES.forEach((obs$) => observe(() => obs$.get()));
  authReady$.set(true);
});

beforeEach(() => {
  mockServer.tables.clear();
  mockServer.maxRows = 1000;
});

describe('pulling a table larger than the server returns in one response', () => {
  it('holds all 2,500 rows when the server cuts responses at 1,000', async () => {
    mockServer.tables.set('transactions', rows(2500));
    await launch();
    expect(heldIds()).toHaveLength(2500);
    expect(heldIds()[2499]).toBe(id(2499));
  });

  it('holds every row when the server cuts responses below the page size', async () => {
    mockServer.maxRows = 400;
    mockServer.tables.set('transactions', rows(1000));
    await launch();
    expect(heldIds()).toHaveLength(1000);
  });

  it('asks for pages from where the last one stopped, ending on an empty page', async () => {
    mockServer.tables.set('transactions', rows(2500));
    await launch();
    expect(pullsOfTransactions()).toEqual([
      'transactions 0-999',
      'transactions 1000-1999',
      'transactions 2000-2999',
      'transactions 2500-3499',
    ]);
  });

  it('removes a row soft-deleted past the first page, and keeps the rest', async () => {
    mockServer.tables.set('transactions', [
      ...rows(1500),
      transaction(1500, { deleted: true }),
      transaction(1501),
    ]);
    await launch();
    expect(heldIds()).toHaveLength(1501);
    expect(heldIds()).not.toContain(id(1500));
    expect(heldIds()).toContain(id(1501));
  });

  it('pulls only what changed since the last pull, across pages', async () => {
    mockServer.tables.set('transactions', rows(1200));
    await launch();
    const newer = rows(1100, 5000);
    mockServer.tables.set('transactions', [...rows(1200), ...newer]);
    mockServer.requests.length = 0;
    await syncState(transactions$).get().sync?.();
    await settle();
    expect(heldIds()).toHaveLength(2300);
    expect(pullsOfTransactions()).toEqual([
      'transactions 0-999',
      'transactions 1000-1999',
      'transactions 1100-2099',
    ]);
  });

  it('keeps what the phone holds when a later page fails', async () => {
    mockServer.tables.set('transactions', rows(1500));
    await launch();
    expect(heldIds()).toHaveLength(1500);
    mockServer.tables.set('transactions', rows(2500));
    mockServer.requests.length = 0;
    mockServer.failOnRequest = 2;
    await syncState(transactions$).get().sync?.();
    await settle();
    expect(heldIds()).toHaveLength(1500);
  });
});
