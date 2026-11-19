import { observe, syncState, when } from '@legendapp/state';
import {
  backupTables,
  buildMoniExport,
  createCalendar,
  planImport,
  planRestore,
  readImportFile,
  readMoniExport,
  restoreTotals,
  type ImportSession,
  type RawRow,
} from '@repo/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { applyWrites } from '../apply';
import { applyPlan, readStoreSnapshot, storeHasPulled } from '../backup';
import { memoryPersist } from '../persist';
import { createMoniStore } from '../store';
import { fakeSupabase } from './fake-supabase';

/**
 * The real store and Legend-State sync over a stand-in for Postgres that keeps its soft-deleted
 * rows and refuses a second row with an id, as the real one does.
 */
type Row = Record<string, unknown>;

const KL = createCalendar('Asia/Kuala_Lumpur');
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const uuid = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;

let nextId = 900;
const newId = () => uuid((nextId += 1));

const { server, supabase } = fakeSupabase();
const store = createMoniStore({ supabase, persist: memoryPersist(), uuid: newId });
const transactions$ = store.transactions$;

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
  server.tables.clear();
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
    server.tables.set(table, []);
  }
  server.tables.get('wallets')!.push(
    stamped({ id: WALLET, name: 'Maybank', type: 'bank', currency: 'MYR', initial_balance: '0.00', is_active: true, display_order: 0 }),
  );
  server.tables.get('categories')!.push({
    ...stamped({ id: CATEGORY, name: 'Food', type: 'expense', is_active: true, display_order: 1 }),
    user_id: null,
  });
  server.tables.get('transactions')!.push(transaction(LUNCH, 'Grab'), transaction(COFFEE, 'Kopi'));
  server.missingColumns.add('transactions.place_id');
}

async function settle() {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setTimeout(resolve, 15));
}

const serverRows = (table: string) => server.tables.get(table) ?? [];
const liveIds = (table: string) =>
  serverRows(table)
    .filter((row) => !row.deleted)
    .map((row) => row.id);
const localTransaction = (id: string) => (transactions$.peek() as Record<string, RawRow>)[id]!;

const exportTables = () => backupTables(readStoreSnapshot(store), USER);

function exportNow(): string {
  return buildMoniExport(exportTables(), USER, new Date(), KL);
}

function planFromFile(csv: string) {
  const read = readMoniExport(csv.slice(1));
  if (read.kind !== 'moni') throw new Error('not a Moni export');
  return planRestore(read.file, readStoreSnapshot(store), USER);
}

const write = (plan: Parameters<typeof applyPlan>[1]) => applyPlan(store, plan, { newId });

describe('restoring through the real store', () => {
  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    seedServer();
    server.offline = true;
    store.all.forEach((obs$) => observe(() => obs$.get()));
    store.authReady$.set(true);
  });

  it('is not ready until the first pull has reached this device', async () => {
    server.offline = true;
    await store.enableStoreSync({ fullReset: true }).catch(() => {});
    await settle();
    expect(storeHasPulled(store)).toBe(false);

    server.offline = false;
    await store.enableStoreSync({ fullReset: true });
    await settle();
    expect(storeHasPulled(store)).toBe(true);
    await when(() => syncState(transactions$).isLoaded.get());
    expect(Object.keys(transactions$.peek() ?? {}).sort()).toEqual([LUNCH, COFFEE]);
  });

  it('adds nothing and calls the server for nothing when the same data is already here', async () => {
    const plan = planFromFile(exportNow());
    expect(restoreTotals(plan)).toEqual({ fresh: 0, here: 3 });
    expect(await write(plan)).toBe(0);
    await settle();
    expect(server.inserted).toEqual([]);
    expect(serverRows('transactions')).toHaveLength(2);
  });

  it('brings back a row deleted since the export without a second copy or a failed sync', async () => {
    const csv = exportNow();

    applyWrites(store, {
      insert: [],
      patch: [],
      softDelete: [{ table: 'transactions', id: LUNCH, at: new Date().toISOString() }],
    });
    await settle();
    expect(serverRows('transactions').find((row) => row.id === LUNCH)?.deleted).toBe(true);

    // What a pull does to a soft-deleted row: gone from this device, still on the server.
    transactions$[LUNCH]!.delete();
    await settle();
    server.clashes.length = 0;

    const plan = planFromFile(csv);
    expect(plan.writes.transactions.map((row) => row.id)).toEqual([LUNCH]);
    await write(plan);
    await settle();

    expect(server.clashes).toEqual([`transactions ${LUNCH}`]);
    expect(serverRows('transactions')).toHaveLength(2);
    expect(liveIds('transactions').sort()).toEqual([LUNCH, COFFEE]);
    expect(syncState(transactions$).error.peek()).toBeUndefined();
    expect(localTransaction(LUNCH).created_at).toEqual(new Date(AT));
  });

  it('finds zero new rows on the run after that, on the device and on the server', async () => {
    const before = serverRows('transactions').length;
    const plan = planFromFile(exportNow());
    expect(restoreTotals(plan).fresh).toBe(0);
    await write(plan);
    await settle();
    expect(serverRows('transactions')).toHaveLength(before);
  });

  it('writes a truly new row as an insert, with its id', async () => {
    const csv = exportNow().replace(COFFEE, DELETED_ON_SERVER);
    server.inserted.length = 0;
    const plan = planFromFile(csv);
    expect(plan.writes.transactions.map((row) => row.id)).toEqual([DELETED_ON_SERVER]);
    await write(plan);
    await settle();
    expect(server.inserted).toEqual([`transactions ${DELETED_ON_SERVER}`]);
    expect(liveIds('transactions')).toContain(DELETED_ON_SERVER);
  });

  it('adopts a row another device has live, without overwriting it', async () => {
    const other = uuid(43);
    server.tables.get('transactions')!.push(transaction(other, 'Edited elsewhere'));
    // This device has not pulled it yet, and the file holds an older copy.
    const file = exportNow().replace(DELETED_ON_SERVER, other);
    server.clashes.length = 0;
    const plan = planFromFile(file);
    expect(plan.writes.transactions.map((row) => row.id)).toEqual([other]);
    await write(plan);
    await settle();
    expect(server.clashes).toEqual([`transactions ${other}`]);
    expect(serverRows('transactions').find((row) => row.id === other)?.merchant).toBe('Edited elsewhere');
    expect(localTransaction(other).created_at).toEqual(new Date(AT));
    expect(localTransaction(other).merchant).toBe('Edited elsewhere');
  });

  it('adds a generic CSV once: a second run through the store writes nothing', async () => {
    const bytes = Uint8Array.from('Date,Merchant,Amount\n20/10/2026,Roti,-5.00\n20/10/2026,Roti,-5.00\n', (char) =>
      char.charCodeAt(0),
    );
    const read = readImportFile('bank.csv', bytes, USER);
    if (read.kind !== 'ok' || read.session.kind !== 'generic') throw new Error('expected generic');
    const generic: ImportSession = {
      ...read.session,
      choices: { ...read.session.choices, wallet: { id: WALLET, currency: 'MYR' } },
    };
    const plan = () => planImport(generic, readStoreSnapshot(store), { userId: USER, aliases: [], calendar: KL });
    const before = serverRows('transactions').length;

    const first = plan();
    expect(first?.kind === 'generic' && first.fresh.length).toBe(2);
    expect(await write(first!)).toBe(2);
    await settle();
    expect(serverRows('transactions')).toHaveLength(before + 2);

    const second = plan();
    expect(second?.kind === 'generic' && [second.fresh.length, second.here.length]).toEqual([0, 2]);
    await write(second!);
    await settle();
    expect(serverRows('transactions')).toHaveLength(before + 2);
  });

  it('leaves out a column whose migration the server does not have yet', async () => {
    const wallet = uuid(2);
    const tables = exportTables();
    tables.wallets = [{ ...tables.wallets[0], id: wallet, record_location: true }];
    const plan = planFromFile(buildMoniExport(tables, USER, new Date(), KL));
    expect(plan.writes.wallets[0]!.record_location).toBe(true);
    await write(plan);
    await settle();
    expect(serverRows('wallets').find((row) => row.id === wallet)).not.toHaveProperty('record_location');
    expect(Object.keys(store.wallets$.peek() ?? {})).toContain(wallet);
  });

  it("drops Google's coordinates and the place columns when the server has no place ids yet", async () => {
    const google = uuid(44);
    const own = uuid(45);
    const tables = exportTables();
    const lunch = tables.transactions.find((row) => row.id === LUNCH)!;
    const place = { location_latitude: 3.139, location_longitude: 101.6869, location_name: 'Mid Valley' };
    tables.transactions = [
      { ...lunch, ...place, id: google, place_id: 'ChIJgoogle', place_coords_at: '2026-10-01T00:00:00.000Z' },
      { ...lunch, ...place, id: own, place_id: 'ChIJown', place_coords_at: null },
    ];
    const plan = planFromFile(buildMoniExport(tables, USER, new Date(), KL));
    expect(plan.writes.transactions.map((row) => row.place_id)).toEqual(['ChIJgoogle', 'ChIJown']);
    await write(plan);
    await settle();
    const saved = (id: string) => serverRows('transactions').find((row) => row.id === id);
    expect(saved(google)).toMatchObject({ location_latitude: null, location_longitude: null, location_name: 'Mid Valley' });
    expect(saved(own)).toMatchObject({ location_latitude: 3.139, location_longitude: 101.6869 });
    for (const id of [google, own]) {
      expect(saved(id)).not.toHaveProperty('place_id');
      expect(saved(id)).not.toHaveProperty('place_coords_at');
    }
  });

  it("works a debt's status out again when a restore pays it off", async () => {
    const debt = uuid(60);
    const lent = uuid(61);
    const lentCash = uuid(62);
    const repaid = uuid(63);
    const repaidCash = uuid(64);
    const activity = (id: string, kind: string, cash: string) => ({
      id,
      user_id: USER,
      debt_id: debt,
      kind,
      amount: '30.00',
      activity_date: AT,
      wallet_id: WALLET,
      cash_transaction_id: cash,
      note: null,
    });
    const cash = (id: string, type: string, activityId: string) => ({
      ...transaction(id, 'Mei'),
      type,
      amount: '30.00',
      analysis_excluded: true,
      debt_activity_id: activityId,
    });
    const debtRow = stamped({
      id: debt,
      counterparty_name: 'Mei',
      direction: 'owed_to_me',
      currency: 'MYR',
      status: 'open',
    });
    server.tables.get('debts')!.push(debtRow);
    server.tables.get('debt_activities')!.push(stamped(activity(lent, 'principal', lentCash)));
    server.tables.get('transactions')!.push(cash(lentCash, 'expense', lent));
    await store.enableStoreSync({ fullReset: true });
    await settle();

    const tables = exportTables();
    tables.debtActivities = [...tables.debtActivities, activity(repaid, 'repayment', repaidCash)];
    tables.transactions = [...tables.transactions, cash(repaidCash, 'income', repaid)];
    const plan = planFromFile(buildMoniExport(tables, USER, new Date(), KL));
    expect(plan.debtsToRefresh).toEqual([debt]);
    await write(plan);
    await settle();

    expect(serverRows('debts').find((row) => row.id === debt)?.status).toBe('settled');
  });
});
