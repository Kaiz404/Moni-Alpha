import { observe, syncState, when } from '@legendapp/state';

import { applyPlan } from '@/lib/backup/apply';
import { planImport, readPickedFile, type ImportSession } from '@/lib/backup/import-session';
import { buildMoniExport, type RawRow } from '@/lib/backup/moni-export';
import { planRestore, restoreTotals } from '@/lib/backup/plan';
import { readMoniExport } from '@/lib/backup/read-moni-export';
import {
  readBackupTables,
  readStoreSnapshot,
  storeHasPulled,
} from '@/lib/backup/store-tables';
import {
  ALL_STORE_OBSERVABLES,
  enableStoreSync,
  transactions$,
  wallets$,
} from '@/lib/store';
import { authReady$ } from '@/lib/store/auth-sync';
import { deleteTransaction } from '@/lib/supabase/transactions';

/**
 * The real store and Legend-State sync over a stand-in for Postgres that keeps its soft-deleted
 * rows and refuses a second row with an id, as the real one does. This is what the phone would do
 * without a phone.
 */
type Row = Record<string, unknown>;

const mockServer = {
  tables: new Map<string, Row[]>(),
  /** Every call fails, as a phone with no signal sees. */
  offline: false,
  inserts: [] as string[],
  clashes: [] as string[],
};

const mockNow = () => new Date().toISOString();

function mockQuery(table: string) {
  let run: (rows: Row[]) => { data: unknown; error: unknown } = (rows) => ({ data: rows, error: null });
  const filters: ((row: Row) => boolean)[] = [];
  let from = 0;
  const query: any = {
    select: () => query,
    limit: () => query,
    order: () => query,
    range: (start: number) => {
      from = start;
      return query;
    },
    gt: (field: string, value: string) => {
      filters.push((row) => String(row[field]) > value);
      return query;
    },
    eq: (field: string, value: unknown) => {
      filters.push((row) => row[field] === value);
      return query;
    },
    insert: (input: Row) => {
      run = (rows) => {
        if (rows.some((row) => row.id === input.id)) {
          mockServer.clashes.push(`${table} ${String(input.id)}`);
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        const at = mockNow();
        const row = { ...input, created_at: at, updated_at: at };
        rows.push(row);
        mockServer.inserts.push(`${table} ${String(input.id)}`);
        return { data: [row], error: null };
      };
      return query;
    },
    update: (input: Row) => {
      run = (rows) => {
        const matched = rows.filter((row) => filters.every((filter) => filter(row)));
        for (const row of matched) Object.assign(row, input, { updated_at: mockNow() });
        return { data: matched, error: null };
      };
      return query;
    },
    then: (resolve: any, reject: any) => {
      if (mockServer.offline) {
        return Promise.resolve({ data: null, error: { message: 'Network request failed' } }).then(
          resolve,
          reject,
        );
      }
      const rows = mockServer.tables.get(table);
      if (!rows) {
        return Promise.resolve({
          data: null,
          error: { code: 'PGRST205', message: `Could not find the table ${table}` },
        }).then(resolve, reject);
      }
      const result = run(rows);
      const data = Array.isArray(result.data)
        ? result.data.filter((row) => filters.every((filter) => filter(row as Row))).slice(from)
        : result.data;
      return Promise.resolve({ ...result, data }).then(resolve, reject);
    },
  };
  return query;
}

jest.mock('@/lib/supabase/client', () => ({
  getUserId: async () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  supabase: {
    from: (table: string) => mockQuery(table),
    channel: () => {
      const channel: any = { on: () => channel, subscribe: () => channel, unsubscribe: () => {} };
      return channel;
    },
  },
}));
jest.mock('@/lib/supabase/profile', () => ({
  getProfilePreferences: async () => ({}),
  updateProfilePreferences: async () => {},
}));
let mockNextId = 900;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `${String((mockNextId += 1)).padStart(8, '0')}-0000-4000-8000-000000000000`,
}));
jest.mock('@/lib/notifications/linked-packages-cache', () => ({
  refreshLinkedPackagesFromStore: () => [],
}));

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const uuid = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;

const WALLET = uuid(1);
const CATEGORY = uuid(10);
const LUNCH = uuid(40);
const COFFEE = uuid(41);
const DELETED_ON_SERVER = uuid(42);

const AT = '2026-10-01T00:00:00.000Z';
const stamped = (row: Row) => ({ ...row, user_id: USER, created_at: AT, updated_at: AT, deleted: false });
const transaction = (id: string, merchant: string) =>
  stamped({
    id,
    wallet_id: WALLET,
    amount: '12.50',
    currency: 'MYR',
    type: 'expense',
    analysis_excluded: false,
    merchant,
    transaction_date: AT,
    metadata: { source: 'manual' },
  });

function seedServer() {
  mockServer.tables.clear();
  for (const table of [
    'wallets',
    'categories',
    'tags',
    'transaction_tags',
    'category_budgets',
    'debts',
    'debt_activities',
    'proposed_transactions',
    'recurring_overrides',
    'auto_add_rules',
    'transactions',
  ]) {
    mockServer.tables.set(table, []);
  }
  mockServer.tables.get('wallets')!.push(
    stamped({ id: WALLET, name: 'Maybank', type: 'bank', currency: 'MYR', initial_balance: '0.00', is_active: true, display_order: 0 }),
  );
  mockServer.tables.get('categories')!.push({
    ...stamped({ id: CATEGORY, name: 'Food', type: 'expense', is_active: true, display_order: 1 }),
    user_id: null,
  });
  mockServer.tables.get('transactions')!.push(transaction(LUNCH, 'Grab'), transaction(COFFEE, 'Kopi'));
}

async function settle() {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setTimeout(resolve, 15));
}

const serverRows = (table: string) => mockServer.tables.get(table) ?? [];
const liveIds = (table: string) =>
  serverRows(table)
    .filter((row) => !row.deleted)
    .map((row) => row.id);

function exportNow(): string {
  return buildMoniExport(readBackupTables(USER), USER, new Date());
}

function planFromFile(csv: string) {
  const read = readMoniExport(csv.slice(1));
  if (read.kind !== 'moni') throw new Error('not a Moni export');
  return planRestore(read.file, readStoreSnapshot(), USER);
}

describe('restoring through the real store', () => {
  beforeAll(async () => {
    seedServer();
    mockServer.offline = true;
    ALL_STORE_OBSERVABLES.forEach((obs$) => observe(() => obs$.get()));
    authReady$.set(true);
  });

  it('is not ready until the first pull has reached this phone', async () => {
    mockServer.offline = true;
    await enableStoreSync({ fullReset: true }).catch(() => {});
    await settle();
    expect(storeHasPulled()).toBe(false);

    mockServer.offline = false;
    await enableStoreSync({ fullReset: true });
    await settle();
    expect(storeHasPulled()).toBe(true);
    await when(() => syncState(transactions$).isLoaded.get());
    expect(Object.keys(transactions$.peek() ?? {}).sort()).toEqual([LUNCH, COFFEE]);
  });

  it('adds nothing and calls the server for nothing when the same data is already here', async () => {
    const csv = exportNow();
    const plan = planFromFile(csv);
    expect(restoreTotals(plan)).toEqual({ fresh: 0, here: 3 });
    expect(await applyPlan(plan)).toBe(0);
    await settle();
    expect(mockServer.inserts).toEqual([]);
    expect(serverRows('transactions')).toHaveLength(2);
  });

  it('brings back a row deleted since the export without a second copy or a failed sync', async () => {
    const csv = exportNow();

    await deleteTransaction(LUNCH);
    await settle();
    expect(serverRows('transactions').find((row) => row.id === LUNCH)?.deleted).toBe(true);

    // What a pull does to a soft-deleted row: gone from this phone, still on the server.
    transactions$[LUNCH].delete();
    await settle();
    mockServer.clashes.length = 0;

    const plan = planFromFile(csv);
    expect(plan.writes.transactions.map((row) => row.id)).toEqual([LUNCH]);
    await applyPlan(plan);
    await settle();

    expect(mockServer.clashes).toEqual([`transactions ${LUNCH}`]);
    expect(serverRows('transactions')).toHaveLength(2);
    expect(liveIds('transactions').sort()).toEqual([LUNCH, COFFEE]);
    expect(syncState(transactions$).error.peek()).toBeUndefined();
    expect((transactions$.peek() as Record<string, RawRow>)[LUNCH].created_at).toBeTruthy();
  });

  it('finds zero new rows on the run after that, on the phone and on the server', async () => {
    const csv = exportNow();
    const before = serverRows('transactions').length;
    const plan = planFromFile(csv);
    expect(restoreTotals(plan).fresh).toBe(0);
    await applyPlan(plan);
    await settle();
    expect(serverRows('transactions')).toHaveLength(before);
  });

  it('writes a truly new row as an insert, with its id', async () => {
    const csv = exportNow().replace(COFFEE, DELETED_ON_SERVER);
    mockServer.inserts.length = 0;
    const plan = planFromFile(csv);
    expect(plan.writes.transactions.map((row) => row.id)).toEqual([DELETED_ON_SERVER]);
    await applyPlan(plan);
    await settle();
    expect(mockServer.inserts).toEqual([`transactions ${DELETED_ON_SERVER}`]);
    expect(liveIds('transactions')).toContain(DELETED_ON_SERVER);
  });

  it('adopts a row another device has live, without overwriting it', async () => {
    const other = uuid(43);
    mockServer.tables.get('transactions')!.push(transaction(other, 'Edited elsewhere'));
    // This phone has not pulled it yet, and the file holds an older copy.
    const file = exportNow().replace(DELETED_ON_SERVER, other);
    mockServer.clashes.length = 0;
    const plan = planFromFile(file);
    expect(plan.writes.transactions.map((row) => row.id)).toEqual([other]);
    await applyPlan(plan);
    await settle();
    expect(mockServer.clashes).toEqual([`transactions ${other}`]);
    expect(serverRows('transactions').find((row) => row.id === other)?.merchant).toBe(
      'Edited elsewhere',
    );
    const local = (transactions$.peek() as Record<string, RawRow>)[other];
    expect(local.created_at).toBeTruthy();
    expect(local.merchant).toBe('Edited elsewhere');
  });

  it('adds a generic CSV once: a second run through the store writes nothing', async () => {
    const session = readPickedFile(
      'bank.csv',
      Uint8Array.from(Buffer.from('Date,Merchant,Amount\n20/10/2026,Roti,-5.00\n20/10/2026,Roti,-5.00\n', 'utf8')),
      USER,
    );
    if (session.kind !== 'ok' || session.session.kind !== 'generic') throw new Error('expected generic');
    const generic: ImportSession = {
      ...session.session,
      choices: { ...session.session.choices, wallet: { id: WALLET, currency: 'MYR' } },
    };
    const before = serverRows('transactions').length;

    const first = planImport(generic, USER);
    expect(first?.kind === 'generic' && first.fresh.length).toBe(2);
    await applyPlan(first!);
    await settle();
    expect(serverRows('transactions')).toHaveLength(before + 2);

    const second = planImport(generic, USER);
    expect(second?.kind === 'generic' && [second.fresh.length, second.here.length]).toEqual([0, 2]);
    await applyPlan(second!);
    await settle();
    expect(serverRows('transactions')).toHaveLength(before + 2);
  });

  it('leaves out a column whose migration the server does not have yet', async () => {
    const wallet = uuid(2);
    const tables = readBackupTables(USER);
    tables.wallets = [{ ...tables.wallets[0], id: wallet, record_location: true }];
    const plan = planFromFile(buildMoniExport(tables, USER, new Date()));
    expect(plan.writes.wallets[0].record_location).toBe(true);
    await applyPlan(plan);
    await settle();
    expect(serverRows('wallets').find((row) => row.id === wallet)).not.toHaveProperty('record_location');
    expect(Object.keys(wallets$.peek() ?? {})).toContain(wallet);
  });
});
