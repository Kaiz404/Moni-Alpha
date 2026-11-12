import { parseCsv } from '@/lib/backup/csv';
import { readPickedFile, planImport, type ImportSession } from '@/lib/backup/import-session';
import { buildMoniExport, type BackupTables, type RawRow } from '@/lib/backup/moni-export';
import { planGeneric, planRestore, restoreTotals, type StoreSnapshot } from '@/lib/backup/plan';
import { readMoniExport, type MoniFile } from '@/lib/backup/read-moni-export';
import { guessMapping, readGenericTable, readImportRows } from '@/lib/backup/generic-csv';

jest.mock('@/lib/supabase/merchant-aliases', () => ({ listMerchantAliases: () => [] }));

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const uuid = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;

const MAYBANK = uuid(1);
const WISE = uuid(2);
const SYSTEM_FOOD = uuid(10);
const YOGA = uuid(11);
const BUDGET = uuid(20);
const DEBT = uuid(30);
const LENT = uuid(31);
const LENT_CASH = uuid(40);
const LUNCH = uuid(41);
const SALARY = uuid(42);
const CORRECTION = uuid(43);
const TOP_UP = uuid(44);
const WISE_SPEND = uuid(45);

const NOW = new Date(Date.UTC(2026, 9, 14));

const TABLES: BackupTables = {
  wallets: [
    { id: MAYBANK, user_id: USER, name: 'Maybank', type: 'bank', currency: 'MYR', initial_balance: '100.00', is_active: true, display_order: 0 },
    { id: WISE, user_id: USER, name: 'Wise', type: 'bank', currency: 'USD', initial_balance: 0, is_active: false, display_order: 1 },
  ],
  categories: [
    { id: SYSTEM_FOOD, user_id: null, name: 'Food & Dining', type: 'expense', icon: 'silverware-fork-knife', color: '#F1A399', is_active: true, display_order: 1 },
    { id: YOGA, user_id: USER, name: 'Yoga', type: 'expense', icon: 'gift-outline', color: '#C3B2EF', is_active: true, display_order: 101 },
  ],
  budgets: [{ id: BUDGET, user_id: USER, category_id: SYSTEM_FOOD, currency: 'MYR', amount: '200.00' }],
  debts: [{ id: DEBT, user_id: USER, counterparty_name: 'Mei', direction: 'owed_to_me', currency: 'MYR', due_date: null, note: null, status: 'open' }],
  debtActivities: [
    { id: LENT, user_id: USER, debt_id: DEBT, kind: 'principal', amount: '40.00', activity_date: '2026-10-01T00:00:00.000Z', wallet_id: MAYBANK, cash_transaction_id: LENT_CASH, note: null },
  ],
  transactions: [
    { id: LENT_CASH, user_id: USER, wallet_id: MAYBANK, amount: '40.00', currency: 'MYR', type: 'expense', analysis_excluded: true, debt_activity_id: LENT, description: 'Lent to Mei', transaction_date: '2026-10-01T00:00:00.000Z', metadata: { debt_activity_id: LENT } },
    { id: LUNCH, user_id: USER, wallet_id: MAYBANK, amount: '12.50', currency: 'MYR', type: 'expense', analysis_excluded: false, category_id: SYSTEM_FOOD, merchant: '=Grab, "KL"', notes: 'two\nlines', transaction_date: '2026-10-02T04:30:00.000Z', location_latitude: 3.139, location_longitude: 101.6869, location_name: 'Mid Valley', metadata: { source: 'notification', alert: { text: 'RM12.50 at GRAB', amountMinor: 1250, currency: 'MYR' } } },
    { id: SALARY, user_id: USER, wallet_id: MAYBANK, amount: '4200.00', currency: 'MYR', type: 'income', analysis_excluded: false, description: 'Salary', transaction_date: '2026-10-03T00:00:00.000Z', metadata: {} },
    { id: CORRECTION, user_id: USER, wallet_id: MAYBANK, amount: '3.00', currency: 'MYR', type: 'expense', analysis_excluded: true, description: 'Balance correction', transaction_date: '2026-10-04T00:00:00.000Z', metadata: { kind: 'balance_correction', source: 'manual' } },
    { id: TOP_UP, user_id: USER, wallet_id: MAYBANK, transfer_to_wallet_id: MAYBANK, amount: '20.00', currency: 'MYR', type: 'transfer', transaction_date: '2026-10-05T00:00:00.000Z', metadata: {} },
    { id: WISE_SPEND, user_id: USER, wallet_id: WISE, amount: '9.99', currency: 'USD', type: 'expense', transaction_date: '2026-10-06T00:00:00.000Z', metadata: {} },
  ],
};

const SYSTEM_ONLY: StoreSnapshot = {
  wallets: [],
  categories: [TABLES.categories[0]],
  budgets: [],
  debts: [],
  debtActivities: [],
  transactions: [],
};

function exported(tables: BackupTables = TABLES): MoniFile {
  const read = readMoniExport(buildMoniExport(tables, USER, NOW).slice(1));
  if (read.kind !== 'moni') throw new Error('not a Moni export');
  return read.file;
}

/** The store after writing a plan, as a pull would leave it. */
function afterWrite(store: StoreSnapshot, writes: BackupTables): StoreSnapshot {
  const next = { ...store };
  for (const table of Object.keys(next) as (keyof BackupTables)[]) {
    next[table] = [...store[table], ...writes[table]];
  }
  return next;
}

describe('a Moni export read back', () => {
  it('holds every row of every table, with no problems', () => {
    const file = exported();
    expect(file.problems).toEqual([]);
    expect(file.account).toBe(USER);
    expect(file.rows.wallets).toHaveLength(2);
    expect(file.rows.categories).toHaveLength(2);
    expect(file.rows.budgets).toHaveLength(1);
    expect(file.rows.debts).toHaveLength(1);
    expect(file.rows.debtActivities).toHaveLength(1);
    expect(file.rows.transactions).toHaveLength(6);
  });

  it('restores a transaction exactly as it was', () => {
    const plan = planRestore(exported(), SYSTEM_ONLY, USER);
    const lunch = plan.writes.transactions.find((row) => row.id === LUNCH);
    expect(lunch).toEqual({
      id: LUNCH,
      user_id: USER,
      wallet_id: MAYBANK,
      amount: '12.50',
      currency: 'MYR',
      type: 'expense',
      analysis_excluded: false,
      debt_activity_id: null,
      category_id: SYSTEM_FOOD,
      transfer_to_wallet_id: null,
      linked_transaction_id: null,
      merchant: '=Grab, "KL"',
      description: null,
      notes: 'two\nlines',
      transaction_date: '2026-10-02T04:30:00.000Z',
      location_latitude: 3.139,
      location_longitude: 101.6869,
      location_name: 'Mid Valley',
      place_id: null,
      place_coords_at: null,
      receipt_image_url: null,
      metadata: {
        source: 'notification',
        alert: { text: 'RM12.50 at GRAB', amountMinor: 1250, currency: 'MYR' },
      },
      deleted: false,
    });
  });

  it('writes no created_at, which is what makes each row a create in the store', () => {
    const plan = planRestore(exported(), SYSTEM_ONLY, USER);
    for (const rows of Object.values(plan.writes)) {
      for (const row of rows as RawRow[]) {
        expect(row).not.toHaveProperty('created_at');
        expect(row).not.toHaveProperty('updated_at');
      }
    }
  });

  it('keeps each row in its own currency', () => {
    const plan = planRestore(exported(), SYSTEM_ONLY, USER);
    expect(plan.writes.transactions.find((row) => row.id === WISE_SPEND)).toMatchObject({
      currency: 'USD',
      amount: '9.99',
    });
  });

  it('restores the same rows after a spreadsheet saves it with semicolons and padded rows', () => {
    const { rows } = parseCsv(buildMoniExport(TABLES, USER, NOW).slice(1));
    const width = Math.max(...rows.map((row) => row.cells.length));
    const saved = rows
      .map((row) =>
        Array.from({ length: width }, (_, index) => {
          const cell = row.cells[index] ?? '';
          return /[";\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
        }).join(';'),
      )
      .join('\r\n');
    const read = readMoniExport(saved);
    if (read.kind !== 'moni') throw new Error('not a Moni export');
    expect(read.file.problems).toEqual([]);
    expect(planRestore(read.file, SYSTEM_ONLY, USER).writes).toEqual(
      planRestore(exported(), SYSTEM_ONLY, USER).writes,
    );
  });

  it('refuses a version it does not know', () => {
    expect(readMoniExport(`Moni export,2,${USER},x\n`)).toEqual({ kind: 'newer' });
  });

  it('is not mistaken for any other CSV', () => {
    expect(readMoniExport('Date,Amount\n')).toEqual({ kind: 'other' });
  });

  it('names each row it can not read, and takes the rest', () => {
    const csv = [
      `Moni export,1,${USER},x`,
      '',
      'Wallets',
      'Id,Name,Type,Currency,Opening balance',
      `not-an-id,Maybank,bank,MYR,0.00`,
      `${MAYBANK},Maybank,bank,MYR,abc`,
      `${MAYBANK},Maybank,bank,MYR,0.00,surprise`,
      `${MAYBANK},Maybank,bank,ringgit,0.00`,
      `${MAYBANK},Maybank,bank,MYR,0.00`,
      '',
      'Transactions',
      'Id,Timestamp,Type,Amount,Currency,Wallet id,Metadata',
      `${LUNCH},never,expense,1.00,MYR,${MAYBANK},{}`,
      `${LUNCH},2026-10-01T00:00:00Z,lunch,1.00,MYR,${MAYBANK},{}`,
      `${LUNCH},2026-10-01T00:00:00Z,expense,0.00,MYR,${MAYBANK},{}`,
      `${LUNCH},2026-10-01T00:00:00Z,transfer,1.00,MYR,${MAYBANK},{}`,
      `${SALARY},2026-10-01T00:00:00Z,expense,1.00,MYR,${MAYBANK},{not json`,
      `"${CORRECTION},oops`,
    ].join('\n');
    const read = readMoniExport(csv);
    if (read.kind !== 'moni') throw new Error('not a Moni export');
    expect(read.file.problems).toEqual([
      { line: 18, reason: 'A quote never closes' },
      { line: 5, reason: "Id can't be read" },
      { line: 6, reason: "Opening balance can't be read" },
      { line: 7, reason: 'More cells than its heading' },
      { line: 8, reason: "Currency can't be read" },
      { line: 13, reason: "Timestamp can't be read" },
      { line: 14, reason: "Type can't be read" },
      { line: 15, reason: "Amount can't be read" },
      { line: 16, reason: "To wallet id can't be read" },
    ]);
    expect(read.file.rows.wallets).toHaveLength(1);
    expect(read.file.rows.transactions.map((row) => row.fields.metadata)).toEqual([{}]);
  });
});

describe('a Google place read back', () => {
  const PLACE = 'ChIJ5-rvAcdJzDERfSgcL1uO2fQ';
  const placed = (fields: RawRow): BackupTables => ({
    ...TABLES,
    transactions: TABLES.transactions.map((row) => (row.id === LUNCH ? { ...row, ...fields } : row)),
  });
  const lunch = (tables: BackupTables) =>
    planRestore(exported(tables), SYSTEM_ONLY, USER).writes.transactions.find((row) => row.id === LUNCH);

  it('keeps the place id and when its coordinates were fetched', () => {
    expect(lunch(placed({ place_id: PLACE, place_coords_at: '2026-10-02T04:30:00.000Z' }))).toMatchObject({
      location_latitude: 3.139,
      location_longitude: 101.6869,
      place_id: PLACE,
      place_coords_at: '2026-10-02T04:30:00.000Z',
    });
  });

  it("reads the server's +00:00 as Z", () => {
    expect(lunch(placed({ place_id: PLACE, place_coords_at: '2026-10-02T04:30:00+00:00' }))).toMatchObject({
      place_coords_at: '2026-10-02T04:30:00.000Z',
    });
  });

  it('keeps a place id on coordinates of your own', () => {
    expect(lunch(placed({ place_id: PLACE, place_coords_at: null }))).toMatchObject({
      location_latitude: 3.139,
      place_id: PLACE,
      place_coords_at: null,
    });
  });

  it('drops Google coordinates that have no place id to refresh them by', () => {
    expect(lunch(placed({ place_id: null, place_coords_at: '2026-10-02T04:30:00.000Z' }))).toMatchObject({
      location_latitude: null,
      location_longitude: null,
      location_name: 'Mid Valley',
      place_id: null,
      place_coords_at: null,
    });
  });

  it('restores a file from before place ids with none', () => {
    const csv = [
      `Moni export,1,${USER},x`,
      '',
      'Transactions',
      'Id,Timestamp,Type,Amount,Currency,Wallet id,Latitude,Longitude',
      `${LUNCH},2026-10-01T00:00:00Z,expense,1.00,MYR,${MAYBANK},3.139,101.6869`,
    ].join('\n');
    const read = readMoniExport(csv);
    if (read.kind !== 'moni') throw new Error('not a Moni export');
    expect(read.file.problems).toEqual([]);
    expect(read.file.rows.transactions[0].fields).toMatchObject({
      location_latitude: 3.139,
      place_id: null,
      place_coords_at: null,
    });
  });

  it('names a fetched time it can not read', () => {
    const read = readMoniExport(
      buildMoniExport(placed({ place_id: PLACE, place_coords_at: 'last week' }), USER, NOW).slice(1),
    );
    if (read.kind !== 'moni') throw new Error('not a Moni export');
    expect(read.file.problems.map((problem) => problem.reason)).toEqual(["Place fetched can't be read"]);
  });
});

describe('planRestore: the idempotence rule', () => {
  it('sees everything as new on an empty account, and writes parents with their rows', () => {
    const plan = planRestore(exported(), SYSTEM_ONLY, USER);
    expect(plan.counts).toEqual({
      wallets: { fresh: 2, here: 0 },
      categories: { fresh: 1, here: 0 },
      budgets: { fresh: 1, here: 0 },
      debts: { fresh: 1, here: 0 },
      debtActivities: { fresh: 1, here: 0 },
      transactions: { fresh: 6, here: 0 },
    });
    expect(restoreTotals(plan)).toEqual({ fresh: 12, here: 0 });
    expect(plan.problems).toEqual([]);
    expect(plan.debtsToRefresh).toEqual([]);
  });

  it('finds zero new rows on a second run', () => {
    const file = exported();
    const first = planRestore(file, SYSTEM_ONLY, USER);
    const second = planRestore(file, afterWrite(SYSTEM_ONLY, first.writes), USER);
    expect(restoreTotals(second)).toEqual({ fresh: 0, here: 12 });
    for (const rows of Object.values(second.writes)) expect(rows).toEqual([]);
  });

  it('finds zero new rows after a reinstall pulled the same rows back', () => {
    expect(restoreTotals(planRestore(exported(), TABLES, USER))).toEqual({ fresh: 0, here: 12 });
  });

  it('finishes a run that stopped halfway, writing only what is missing', () => {
    const file = exported();
    const all = planRestore(file, SYSTEM_ONLY, USER).writes;
    const partial: BackupTables = {
      ...all,
      budgets: [],
      debts: all.debts,
      debtActivities: [],
      transactions: all.transactions.slice(0, 2),
    };
    const rest = planRestore(file, afterWrite(SYSTEM_ONLY, partial), USER);
    expect(rest.writes.transactions.map((row) => row.id)).toEqual(
      all.transactions.slice(2).map((row) => row.id),
    );
    expect(rest.writes.budgets).toHaveLength(1);
    expect(rest.writes.debtActivities).toHaveLength(1);
    expect(rest.writes.wallets).toEqual([]);
    expect(restoreTotals(planRestore(file, afterWrite(afterWrite(SYSTEM_ONLY, partial), rest.writes), USER)).fresh).toBe(0);
  });

  it('never overwrites a row the store holds, however it has changed since', () => {
    const edited = {
      ...TABLES,
      transactions: TABLES.transactions.map((row) =>
        row.id === LUNCH ? { ...row, amount: '99.00', notes: 'edited' } : row,
      ),
    };
    expect(planRestore(exported(), edited, USER).writes.transactions).toEqual([]);
  });

  it('leaves a row soft-deleted on this phone alone', () => {
    const deleted = {
      ...TABLES,
      transactions: TABLES.transactions.map((row) =>
        row.id === LUNCH ? { ...row, deleted: true } : row,
      ),
    };
    const plan = planRestore(exported(), deleted, USER);
    expect(plan.writes.transactions).toEqual([]);
    expect(plan.counts.transactions).toEqual({ fresh: 0, here: 6 });
  });

  it('counts a repeated id in the file once', () => {
    const file = exported();
    const twice: MoniFile = {
      ...file,
      rows: { ...file.rows, transactions: [...file.rows.transactions, { ...file.rows.transactions[0], line: 99 }] },
    };
    const plan = planRestore(twice, SYSTEM_ONLY, USER);
    expect(plan.counts.transactions.fresh).toBe(6);
    expect(plan.problems).toEqual([
      { line: 99, reason: `Same id as line ${file.rows.transactions[0].line}` },
    ]);
  });
});

describe('planRestore: rows that point at other rows', () => {
  it('matches a budget by category and currency, whatever its id', () => {
    const other = { ...TABLES.budgets[0], id: uuid(99) };
    const plan = planRestore(exported(), { ...TABLES, budgets: [other] }, USER);
    expect(plan.counts.budgets).toEqual({ fresh: 0, here: 1 });
    expect(plan.writes.budgets).toEqual([]);
  });

  it('never writes a system category, and follows one reseeded under a new id', () => {
    const reseeded = { ...TABLES.categories[0], id: uuid(77) };
    const store = { ...SYSTEM_ONLY, categories: [reseeded] };
    const plan = planRestore(exported(), store, USER);
    expect(plan.writes.categories.map((row) => row.id)).toEqual([YOGA]);
    expect(plan.writes.categories[0].color).toBe('#9A76F8');
    expect(plan.writes.transactions.find((row) => row.id === LUNCH)?.category_id).toBe(uuid(77));
    expect(plan.writes.budgets[0].category_id).toBe(uuid(77));
  });

  it('uses a custom category of the same name, because a name is unique among active ones', () => {
    const same = { ...TABLES.categories[1], id: uuid(78), name: ' yoga ' };
    const file = exported({
      ...TABLES,
      transactions: [{ ...TABLES.transactions[1], id: uuid(50), category_id: YOGA }],
    });
    const plan = planRestore(file, { ...SYSTEM_ONLY, categories: [TABLES.categories[0], same] }, USER);
    expect(plan.writes.categories).toEqual([]);
    expect(plan.counts.categories).toEqual({ fresh: 0, here: 1 });
    expect(plan.writes.transactions[0].category_id).toBe(uuid(78));
  });

  it('keeps a transaction whose category is gone, with no category', () => {
    const file = exported({
      ...TABLES,
      categories: [],
      budgets: [],
      transactions: [{ ...TABLES.transactions[1], category_id: uuid(88) }],
    });
    const plan = planRestore(file, SYSTEM_ONLY, USER);
    expect(plan.writes.transactions[0].category_id).toBeNull();
  });

  it('skips a row whose wallet or debt is nowhere', () => {
    const file = exported({
      ...TABLES,
      wallets: [],
      debts: [],
      categories: [],
      budgets: [],
      debtActivities: [TABLES.debtActivities[0]],
      transactions: [TABLES.transactions[1]],
    });
    const plan = planRestore(file, SYSTEM_ONLY, USER);
    expect(plan.writes.transactions).toEqual([]);
    expect(plan.writes.debtActivities).toEqual([]);
    expect(plan.problems.map((problem) => problem.reason)).toEqual([
      'Its debt is not in this file or in Moni',
      'Its wallet is not in this file or in Moni',
    ]);
  });

  it('skips a custom category the database would refuse', () => {
    const file = exported({
      ...TABLES,
      categories: [{ ...TABLES.categories[1], icon: 'not-an-icon' }],
      budgets: [],
      transactions: [],
    });
    const plan = planRestore(file, SYSTEM_ONLY, USER);
    expect(plan.writes.categories).toEqual([]);
    expect(plan.problems[0].reason).toBe('This category has an icon or colour Moni does not offer');
  });

  it('asks for a debt to be worked out again when it gains activity', () => {
    const store = { ...TABLES, debtActivities: [] };
    expect(planRestore(exported(), store, USER).debtsToRefresh).toEqual([DEBT]);
  });
});

describe('planRestore: rows reports must leave out', () => {
  const excluded = (tables: BackupTables) => {
    const rows = planRestore(exported(tables), SYSTEM_ONLY, USER).writes.transactions;
    return Object.fromEntries(rows.map((row) => [row.id, row.analysis_excluded]));
  };

  it('keeps debt cash and balance corrections out of spending', () => {
    expect(excluded(TABLES)).toMatchObject({ [LENT_CASH]: true, [CORRECTION]: true, [LUNCH]: false });
  });

  it('keeps them out even when the flag was lost', () => {
    const lost = {
      ...TABLES,
      transactions: TABLES.transactions.map((row) => ({ ...row, analysis_excluded: false })),
    };
    expect(excluded(lost)).toMatchObject({ [LENT_CASH]: true, [CORRECTION]: true, [LUNCH]: false });
  });
});

describe('planGeneric: date, amount and merchant', () => {
  const WALLET = { id: MAYBANK, currency: 'MYR' };
  const target = { userId: USER, wallet: WALLET, aliases: [] };
  const read = (csv: string) => {
    const table = readGenericTable(csv)!;
    return readImportRows(table, guessMapping(table.headers), 'dmy');
  };
  const EMPTY = { ...SYSTEM_ONLY };
  const stored = (writes: RawRow[]): StoreSnapshot => ({
    ...EMPTY,
    transactions: writes.map((row, index) => ({ ...row, id: uuid(100 + index) })),
  });

  const CSV = 'Date,Merchant,Amount\n14/10/2026,Grab,-12.00\n14/10/2026,Grab,-12.00\n15/10/2026,Salary,4200\n';

  it('finds zero new rows on a second run', () => {
    const { rows, problems } = read(CSV);
    const first = planGeneric(rows, problems, EMPTY, target);
    expect([first.fresh.length, first.here.length]).toEqual([3, 0]);
    const second = planGeneric(rows, problems, stored(first.writes), target);
    expect([second.fresh.length, second.here.length]).toEqual([0, 3]);
    expect(second.writes).toEqual([]);
  });

  it('keeps two identical payments in one file, and finishes a run that stopped after one', () => {
    const { rows, problems } = read(CSV);
    const first = planGeneric(rows, problems, EMPTY, target);
    const resumed = planGeneric(rows, problems, stored(first.writes.slice(0, 1)), target);
    expect(resumed.fresh.map((row) => row.line)).toEqual([3, 4]);
    expect(resumed.here.map((row) => row.line)).toEqual([2]);
  });

  it('matches a capture Moni already has, whatever the bank calls the merchant', () => {
    const { rows, problems } = read('Date,Merchant,Amount\n14/10/2026,GRAB*1234 KL,-12.00\n');
    const held = stored([
      {
        user_id: USER,
        merchant: 'Grab A-98QZ',
        amount: '12.00',
        currency: 'MYR',
        type: 'expense',
        transaction_date: new Date(2026, 9, 14, 19, 30).toISOString(),
      },
    ]);
    const plan = planGeneric(rows, problems, held, target);
    expect([plan.fresh.length, plan.here.length]).toEqual([0, 1]);
  });

  it('tells apart another day, amount, merchant, direction and currency', () => {
    const { rows, problems } = read(
      [
        'Date,Merchant,Amount',
        '15/10/2026,Grab,-12.00',
        '14/10/2026,Grab,-13.00',
        '14/10/2026,Kedai,-12.00',
        '14/10/2026,Grab,12.00',
      ].join('\n'),
    );
    const held = stored([
      { user_id: USER, merchant: 'Grab', amount: '12.00', currency: 'MYR', type: 'expense', transaction_date: new Date(2026, 9, 14).toISOString() },
      { user_id: USER, merchant: 'Kedai', amount: '12.00', currency: 'USD', type: 'expense', transaction_date: new Date(2026, 9, 14).toISOString() },
    ]);
    const plan = planGeneric(rows, problems, held, target);
    expect(plan.fresh).toHaveLength(4);
  });

  it('applies merchant names on both sides', () => {
    const { rows, problems } = read('Date,Merchant,Amount\n14/10/2026,Touch n Go,-12.00\n');
    const held = stored([
      { user_id: USER, merchant: 'TNG EWALLET', amount: '12.00', currency: 'MYR', type: 'expense', transaction_date: new Date(2026, 9, 14).toISOString() },
    ]);
    const plan = planGeneric(rows, problems, held, {
      ...target,
      aliases: [{ rawKey: 'tng ewallet', displayName: 'Touch n Go' }],
    });
    expect(plan.here).toHaveLength(1);
  });

  it('writes through the wallet, in its currency, as a manual row with a category by name', () => {
    const { rows, problems } = read('Date,Merchant,Amount,Category,Note\n14/10/2026,Kedai,-5.00,food & dining,Roti\n');
    const plan = planGeneric(rows, problems, EMPTY, target);
    expect(plan.writes[0]).toMatchObject({
      user_id: USER,
      wallet_id: MAYBANK,
      amount: '5.00',
      currency: 'MYR',
      type: 'expense',
      category_id: SYSTEM_FOOD,
      merchant: 'Kedai',
      notes: 'Roti',
      metadata: { source: 'manual', imported: true },
      deleted: false,
    });
    expect(plan.writes[0]).not.toHaveProperty('created_at');
  });

  it('never converts: a row in another currency stays out', () => {
    const { rows, problems } = read('Date,Merchant,Amount,Currency\n14/10/2026,Kedai,-5.00,USD\n14/10/2026,Kopi,-3.00,myr\n');
    const plan = planGeneric(rows, problems, EMPTY, target);
    expect(plan.fresh.map((row) => row.merchant)).toEqual(['Kopi']);
    expect(plan.problems).toEqual([{ line: 2, reason: 'In USD, and this wallet is in MYR' }]);
  });
});

describe('readPickedFile', () => {
  const bytes = (text: string) => Uint8Array.from(Buffer.from(text, 'utf8'));

  it('opens an export of this account as a restore', () => {
    const read = readPickedFile('moni.csv', bytes(buildMoniExport(TABLES, USER, NOW)), USER);
    expect(read.kind === 'ok' && read.session.kind).toBe('restore');
  });

  it('refuses an export of another account, whose ids this account can not write', () => {
    expect(readPickedFile('moni.csv', bytes(buildMoniExport(TABLES, uuid(5), NOW)), USER)).toEqual({
      kind: 'problem',
      reason: 'This export is from another Moni account. Sign in to that account to restore it.',
    });
  });

  it('opens any other CSV with a guessed mapping and date order', () => {
    const read = readPickedFile('bank.csv', bytes('Date,Merchant,Amount\n03/04/2026,Grab,-1\n'), USER);
    if (read.kind !== 'ok' || read.session.kind !== 'generic') throw new Error('expected generic');
    expect(read.session.choices.mapping).toMatchObject({ date: 0, merchant: 1, amount: 2 });
    expect(read.session.choices.order).toBe('dmy');
    expect(read.session.choices.orderSettled).toBe(false);
  });

  it('says why it can not read a workbook, a binary, or an empty file', () => {
    expect(readPickedFile('a.xlsx', Uint8Array.from([0x50, 0x4b, 3, 4]), USER)).toMatchObject({
      reason: "That's an Excel workbook. Save it as a CSV, then choose it again.",
    });
    expect(readPickedFile('a.bin', Uint8Array.from([1, 2, 0, 4, 0, 0, 7]), USER)).toMatchObject({
      reason: "That isn't a CSV file.",
    });
    expect(readPickedFile('a.csv', bytes(''), USER)).toMatchObject({
      reason: 'This file has no rows to read.',
    });
    expect(readPickedFile('a.csv', new Uint8Array(21 * 1024 * 1024), USER)).toMatchObject({
      reason: 'This file is over 20 MB.',
    });
  });

  it('asks for a wallet before a plan', () => {
    const read = readPickedFile('bank.csv', bytes('Date,Amount\n14/10/2026,-1\n'), USER);
    if (read.kind !== 'ok') throw new Error('expected a session');
    expect(planImport(read.session as ImportSession, USER)).toBeNull();
  });
});
