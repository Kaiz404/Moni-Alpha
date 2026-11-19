import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';

import type { FinanceDebt, FinanceDebtActivity, FinanceTransaction, FinanceWallet } from '../../read-model/types';
import { planBalanceCorrection } from '../balance-correction';
import {
  planDebt,
  planDebtActivity,
  planDebtActivityDelete,
  planDebtDelete,
  planDebtEdit,
  planDebtMirrorRepair,
  planDebtStatus,
} from '../debts';
import { planImportRows } from '../import';
import { applyToTables } from '../memory';
import { createCalendar } from '../../calendar';
import { groupPlaces } from '../../read-model/places';
import {
  checkTransfer,
  planAddPlace,
  planTransaction,
  planTransactionEdit,
  planTransactionsDelete,
  planTransactionsEdit,
  planTransfer,
} from '../transactions';
import type { LedgerView, PlanContext } from '../types';
import { planWalletCreate, planWalletDelete, planWalletEdit } from '../wallets';

const NOW = '2026-10-14T03:00:00.000Z';
const minor = (value: number) => value as MinorAmount;

function context(migrated = true): PlanContext {
  let next = 0;
  return {
    userId: 'user-1',
    now: NOW,
    newId: () => `new-${(next += 1)}`,
    isMigrated: () => migrated,
  };
}

const wallet = (id: string, currency: 'MYR' | 'SGD' = 'MYR'): FinanceWallet => ({
  id,
  userId: 'user-1',
  name: id,
  type: 'bank',
  currency,
  initialBalanceMinor: minor(0),
  color: null,
  icon: null,
  cardStyleId: null,
  isActive: true,
  displayOrder: 0,
  balanceConfirmedAt: null,
  notificationPackage: null,
  notificationAppLabel: null,
  notificationAccountHint: null,
  updatedAt: NOW,
});

const transaction = (id: string, walletId: string, over: Partial<FinanceTransaction> = {}): FinanceTransaction =>
  ({
    id,
    userId: 'user-1',
    walletId,
    amountMinor: minor(1200),
    currency: 'MYR',
    type: 'expense',
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: null,
    transferToWalletId: null,
    linkedTransactionId: null,
    description: null,
    merchant: null,
    notes: null,
    transactionDate: NOW,
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    placeId: null,
    placeCoordsAt: null,
    receiptImageUrl: null,
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  }) as FinanceTransaction;

const DEBT: FinanceDebt = {
  id: 'debt-1',
  userId: 'user-1',
  counterpartyName: 'Aina',
  direction: 'owed_to_me',
  currency: 'MYR',
  dueDate: null,
  note: null,
  status: 'open',
  createdAt: NOW,
  updatedAt: NOW,
};

const activity = (id: string, kind: FinanceDebtActivity['kind'], amount: number, over: Partial<FinanceDebtActivity> = {}) => ({
  id,
  userId: 'user-1',
  debtId: 'debt-1',
  kind,
  amountMinor: minor(amount),
  activityDate: '2026-10-01T00:00:00.000Z',
  walletId: 'maybank',
  cashTransactionId: `cash-${id}`,
  note: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

function view(parts: Partial<LedgerView> = {}): LedgerView {
  return {
    walletsById: { maybank: wallet('maybank'), cash: wallet('cash'), dbs: wallet('dbs', 'SGD') },
    transactionsById: {},
    debtsById: { 'debt-1': DEBT },
    debtActivitiesById: {},
    ...parts,
  };
}

const EXPENSE_ROW = {
  id: 'new-1',
  user_id: 'user-1',
  wallet_id: 'maybank',
  amount: '12.00',
  currency: 'MYR',
  type: 'expense',
  analysis_excluded: false,
  debt_activity_id: null,
  category_id: 'food',
  transfer_to_wallet_id: null,
  linked_transaction_id: null,
  description: null,
  merchant: 'Grab',
  notes: null,
  transaction_date: NOW,
  location_latitude: null,
  location_longitude: null,
  location_name: null,
  place_id: null,
  place_coords_at: null,
  receipt_image_url: null,
  metadata: { source: 'manual' },
  deleted: false,
};

const BEFORE_PLACE_IDS = Object.fromEntries(
  Object.entries(EXPENSE_ROW).filter(([column]) => column !== 'place_id' && column !== 'place_coords_at'),
);

describe('planTransaction', () => {
  const data = { walletId: 'maybank', amountMinor: minor(1200), type: 'expense' as const, categoryId: 'food', merchant: 'Grab' };

  it.each([
    ['with the place ID columns', true, EXPENSE_ROW],
    ['without them before their migration', false, BEFORE_PLACE_IDS],
  ])('writes the row %s', (_case, migrated, row) => {
    expect(planTransaction(data, 'manual', view(), context(migrated))).toEqual({
      kind: 'writes',
      writes: { insert: [{ table: 'transactions', row }], patch: [], softDelete: [] },
      result: { id: 'new-1' },
    });
  });
});

describe('the transfer rule', () => {
  it.each([
    ['no destination', 'maybank', null, { kind: 'needsInput', field: 'destination' }],
    ['the same wallet twice', 'maybank', 'maybank', { kind: 'error', message: 'Pick two different wallets.' }],
    ['two currencies', 'maybank', 'dbs', { kind: 'error', message: 'Both wallets need the same currency.' }],
    ['a wallet the ledger lacks', 'maybank', 'gone', { kind: 'error', message: 'Wallet not found' }],
    ['two wallets in one currency', 'maybank', 'cash', null],
  ])('answers %s', (_case, from, to, answer) => {
    expect(checkTransfer(view(), from, to)).toEqual(answer);
  });

  it('writes one transfer row from the source wallet', () => {
    const plan = planTransfer(
      { fromWalletId: 'maybank', toWalletId: 'cash', amountMinor: minor(5000), transactionDate: NOW },
      'manual',
      view(),
      context(),
    );
    expect(plan).toMatchObject({
      kind: 'writes',
      writes: {
        insert: [
          {
            table: 'transactions',
            row: {
              id: 'new-1',
              wallet_id: 'maybank',
              transfer_to_wallet_id: 'cash',
              amount: '50.00',
              currency: 'MYR',
              type: 'transfer',
              category_id: null,
              merchant: null,
            },
          },
        ],
      },
    });
  });

  it('refuses an amount of zero', () => {
    expect(planTransfer({ fromWalletId: 'maybank', toWalletId: 'cash', amountMinor: minor(0) }, 'manual', view(), context())).toEqual({
      kind: 'error',
      message: 'Enter an amount above zero.',
    });
  });
});

describe('planTransactionEdit', () => {
  const TNG = '00000000-0000-4000-8000-00000000000a';
  const TRANSPORT = '00000000-0000-4000-8000-00000000000b';
  const ledger = view({
    walletsById: { maybank: wallet('maybank'), [TNG]: wallet(TNG) },
    transactionsById: {
      t1: transaction('t1', 'maybank'),
      mirror: transaction('mirror', 'maybank', { debtActivityId: 'a1' }),
    },
  });

  it('moves a row to another wallet in that wallet’s currency', () => {
    expect(planTransactionEdit('t1', { walletId: TNG, amountMinor: minor(990) }, ledger, context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [{ table: 'transactions', id: 't1', patch: { updated_at: NOW, wallet_id: TNG, amount: '9.90', currency: 'MYR' } }],
        softDelete: [],
      },
      result: { id: 't1' },
    });
  });

  it('refuses a debt’s cash mirror', () => {
    expect(planTransactionEdit('mirror', { amountMinor: minor(990) }, ledger, context())).toEqual({
      kind: 'error',
      message: 'Debt-linked transactions must be changed from the debt activity.',
    });
  });

  it('recategorises many rows at once, or none when one refuses', () => {
    const edit = { categoryId: TRANSPORT };
    expect(planTransactionsEdit(['t1'], edit, ledger, context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [{ table: 'transactions', id: 't1', patch: { updated_at: NOW, category_id: TRANSPORT } }],
        softDelete: [],
      },
      result: [{ id: 't1' }],
    });
    expect(planTransactionsEdit(['t1', 'mirror'], edit, ledger, context()).kind).toBe('error');
  });

  it('deletes many rows softly', () => {
    expect(planTransactionsDelete(['t1', 't2'], context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [],
        softDelete: [
          { table: 'transactions', id: 't1', at: NOW },
          { table: 'transactions', id: 't2', at: NOW },
        ],
      },
      result: null,
    });
  });
});

describe('planAddPlace', () => {
  const placed = transaction('at-bangsar', 'maybank', {
    locationLatitude: 3.13,
    locationLongitude: 101.671,
    locationName: 'Bangsar',
    placeId: 'gp-bangsar',
    transactionDate: '2026-10-11T03:00:00.000Z',
  });
  const ledger = view({
    transactionsById: { 'at-bangsar': placed, shopee: transaction('shopee', 'maybank'), tnb: transaction('tnb', 'maybank') },
  });
  const [bangsar] = groupPlaces([placed], { currency: 'MYR' }, createCalendar('Asia/Kuala_Lumpur'));

  it('pins each picked expense where the place’s payments sit', () => {
    const at = { location_latitude: 3.13, location_longitude: 101.671, location_name: 'Bangsar', place_id: 'gp-bangsar' };
    expect(planAddPlace(['shopee', 'tnb'], bangsar!, ledger, context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [
          { table: 'transactions', id: 'shopee', patch: { updated_at: NOW, ...at } },
          { table: 'transactions', id: 'tnb', patch: { updated_at: NOW, ...at } },
        ],
        softDelete: [],
      },
      result: [{ id: 'shopee' }, { id: 'tnb' }],
    });
  });

  it('leaves the place ID out before its migration, and refuses nothing picked', () => {
    const plan = planAddPlace(['shopee'], bangsar!, ledger, context(false));
    expect(plan.kind === 'writes' && plan.writes.patch[0]).toEqual({
      table: 'transactions',
      id: 'shopee',
      patch: { updated_at: NOW, location_latitude: 3.13, location_longitude: 101.671, location_name: 'Bangsar' },
    });
    expect(planAddPlace([], bangsar!, ledger, context())).toEqual({ kind: 'error', message: 'Pick an expense first.' });
  });
});

describe('planBalanceCorrection', () => {
  it('writes an analysis-excluded row dated now', () => {
    const plan = planBalanceCorrection(
      'maybank',
      {
        type: 'income',
        amountMinor: minor(640),
        description: 'Balance correction',
        categoryId: null,
        merchant: null,
        analysisExcluded: true,
        metadata: { kind: 'balance_correction' },
      },
      view(),
      context(),
    );
    expect(plan).toMatchObject({
      kind: 'writes',
      writes: {
        insert: [
          {
            table: 'transactions',
            row: {
              wallet_id: 'maybank',
              amount: '6.40',
              type: 'income',
              analysis_excluded: true,
              description: 'Balance correction',
              transaction_date: NOW,
              metadata: { kind: 'balance_correction', source: 'manual' },
            },
          },
        ],
      },
    });
  });
});

const MIRROR = {
  user_id: 'user-1',
  wallet_id: 'maybank',
  currency: 'MYR',
  category_id: null,
  transfer_to_wallet_id: null,
  linked_transaction_id: null,
  analysis_excluded: true,
  merchant: null,
  notes: null,
  location_latitude: null,
  location_longitude: null,
  location_name: null,
  receipt_image_url: null,
  deleted: false,
};

describe('debt plans', () => {
  it('opens a debt with its principal and the cash that left the wallet', () => {
    expect(
      planDebt(
        { counterpartyName: ' Aina ', direction: 'owed_to_me', amountMinor: minor(10000), walletId: 'maybank', activityDate: NOW },
        view(),
        context(),
      ),
    ).toEqual({
      kind: 'writes',
      writes: {
        insert: [
          {
            table: 'debts',
            row: {
              id: 'new-1',
              user_id: 'user-1',
              counterparty_name: 'Aina',
              direction: 'owed_to_me',
              currency: 'MYR',
              due_date: null,
              note: null,
              status: 'open',
              deleted: false,
            },
          },
          {
            table: 'debt_activities',
            row: {
              id: 'new-2',
              user_id: 'user-1',
              debt_id: 'new-1',
              kind: 'principal',
              amount: '100.00',
              activity_date: NOW,
              wallet_id: 'maybank',
              cash_transaction_id: 'new-3',
              note: null,
              deleted: false,
            },
          },
          {
            table: 'transactions',
            row: {
              ...MIRROR,
              id: 'new-3',
              amount: '100.00',
              type: 'expense',
              debt_activity_id: 'new-2',
              description: 'Lent to Aina',
              transaction_date: NOW,
              metadata: { debt_activity_id: 'new-2' },
            },
          },
        ],
        patch: [],
        softDelete: [],
      },
      result: {
        debt: { ...DEBT, id: 'new-1' },
      },
    });
  });

  const owed = view({ debtActivitiesById: { a1: activity('a1', 'principal', 10000) } });

  it.each([
    ['a repayment above the balance', { kind: 'repayment', amountMinor: minor(10001), walletId: 'maybank' }, 'Amount cannot exceed the outstanding balance'],
    ['a write-off short of the balance', { kind: 'write_off', amountMinor: minor(5000) }, 'Write-off must settle the full remaining balance'],
    ['cash with no wallet', { kind: 'repayment', amountMinor: minor(5000) }, 'Select a wallet'],
    ['a wallet in another currency', { kind: 'repayment', amountMinor: minor(5000), walletId: 'dbs' }, 'Select a MYR wallet'],
  ] as const)('refuses %s', (_case, input, message) => {
    expect(planDebtActivity(DEBT, input, owed, context())).toEqual({ kind: 'error', message });
  });

  it('settles a debt with a repayment that comes back into the wallet', () => {
    const plan = planDebtActivity(DEBT, { kind: 'repayment', amountMinor: minor(10000), walletId: 'maybank', activityDate: NOW }, owed, context());
    expect(plan.kind === 'writes' && plan.writes).toEqual({
      insert: [
        expect.objectContaining({ table: 'debt_activities', row: expect.objectContaining({ kind: 'repayment', amount: '100.00' }) }),
        {
          table: 'transactions',
          row: {
            ...MIRROR,
            id: 'new-2',
            amount: '100.00',
            type: 'income',
            debt_activity_id: 'new-1',
            description: 'Repayment from Aina',
            transaction_date: NOW,
            metadata: { debt_activity_id: 'new-1' },
          },
        },
      ],
      patch: [{ table: 'debts', id: 'debt-1', patch: { status: 'settled', updated_at: NOW } }],
      softDelete: [],
    });
  });

  it('writes off the rest with no cash', () => {
    const plan = planDebtActivity(DEBT, { kind: 'write_off', amountMinor: minor(10000) }, owed, context());
    expect(plan.kind === 'writes' && plan.writes.insert.map((write) => write.table)).toEqual(['debt_activities']);
    expect(plan.kind === 'writes' && plan.writes.patch).toEqual([
      { table: 'debts', id: 'debt-1', patch: { status: 'written_off', updated_at: NOW } },
    ]);
  });

  it('removes an activity with its cash and reopens the debt', () => {
    const settled = view({
      debtsById: { 'debt-1': { ...DEBT, status: 'settled' } },
      debtActivitiesById: { a1: activity('a1', 'principal', 10000), a2: activity('a2', 'repayment', 10000) },
    });
    expect(planDebtActivityDelete(DEBT, 'a2', settled, context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [{ table: 'debts', id: 'debt-1', patch: { status: 'open', updated_at: NOW } }],
        softDelete: [
          { table: 'debt_activities', id: 'a2', at: NOW },
          { table: 'transactions', id: 'cash-a2', at: NOW },
        ],
      },
      result: null,
    });
    expect(planDebtStatus('debt-1', settled, context())).toEqual({
      kind: 'writes',
      writes: { insert: [], patch: [], softDelete: [] },
      result: null,
    });
  });

  it('edits only the fields it is given, and refuses an empty name', () => {
    expect(planDebtEdit(DEBT, { dueDate: '2026-11-30' }, context())).toEqual({
      kind: 'writes',
      writes: { insert: [], patch: [{ table: 'debts', id: 'debt-1', patch: { due_date: '2026-11-30', updated_at: NOW } }], softDelete: [] },
      result: null,
    });
    expect(planDebtEdit(DEBT, {}, context())).toEqual({ kind: 'writes', writes: { insert: [], patch: [], softDelete: [] }, result: null });
    expect(planDebtEdit(DEBT, { counterpartyName: '  ' }, context())).toEqual({ kind: 'error', message: 'Enter a person’s name' });
  });

  it('removes a whole debt with every activity and its cash, leaving other debts alone', () => {
    const ledger = view({
      debtActivitiesById: {
        a1: activity('a1', 'principal', 10000),
        a2: activity('a2', 'write_off', 10000, { cashTransactionId: null, activityDate: '2026-10-02T00:00:00.000Z' }),
        b1: activity('b1', 'principal', 500, { debtId: 'debt-2' }),
      },
    });
    expect(planDebtDelete(DEBT, ledger, context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [],
        softDelete: [
          { table: 'debt_activities', id: 'a2', at: NOW },
          { table: 'transactions', id: 'cash-a1', at: NOW },
          { table: 'debt_activities', id: 'a1', at: NOW },
          { table: 'debts', id: 'debt-1', at: NOW },
        ],
      },
      result: null,
    });
  });

  it('rebuilds only the cash mirrors the ledger lacks', () => {
    const ledger = view({
      transactionsById: { 'cash-a1': transaction('cash-a1', 'maybank') },
      debtActivitiesById: { a1: activity('a1', 'principal', 10000), a2: activity('a2', 'repayment', 2500) },
    });
    const plan = planDebtMirrorRepair(ledger, context());
    expect(plan).toMatchObject({ result: { repaired: 1 } });
    expect(plan.kind === 'writes' && plan.writes.insert).toEqual([
      {
        table: 'transactions',
        row: {
          ...MIRROR,
          id: 'cash-a2',
          amount: '25.00',
          type: 'income',
          debt_activity_id: 'a2',
          description: 'Repayment from Aina',
          transaction_date: '2026-10-01T00:00:00.000Z',
          metadata: { debt_activity_id: 'a2' },
        },
      },
    ]);
  });
});

describe('planWalletDelete', () => {
  it('takes the wallet’s own transactions with it and leaves transfers in from elsewhere', () => {
    const ledger = view({
      transactionsById: {
        spent: transaction('spent', 'cash'),
        moved: transaction('moved', 'maybank', { type: 'transfer', transferToWalletId: 'cash' }),
      },
    });
    expect(planWalletDelete('cash', ledger, context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [],
        softDelete: [
          { table: 'transactions', id: 'spent', at: NOW },
          { table: 'wallets', id: 'cash', at: NOW },
        ],
      },
      result: null,
    });
  });
});

describe('planWalletEdit', () => {
  const edit = { name: 'Maybank Savings', type: 'bank' as const, color: '#8C5CF3', icon: 'bank', cardStyleId: 'violet-dusk' };

  it('patches the name, type and colour and leaves the currency and balance alone', () => {
    expect(planWalletEdit('maybank', edit, view(), context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [
          {
            table: 'wallets',
            id: 'maybank',
            patch: { name: 'Maybank Savings', type: 'bank', color: '#8C5CF3', icon: 'bank', card_style_id: 'violet-dusk', updated_at: NOW },
          },
        ],
        softDelete: [],
      },
      result: null,
    });
  });

  it('refuses a wallet that is gone', () => {
    expect(planWalletEdit('gone', edit, view(), context())).toEqual({ kind: 'error', message: 'Wallet not found' });
  });
});

describe('planImportRows', () => {
  const row = { id: 't1', place_id: 'gplace', place_coords_at: NOW, location_latitude: 3.1, location_longitude: 101.6, record_location: false };

  it.each([
    ['keeps every column once the migrations ran', true, row],
    [
      'drops the gated columns and Google’s coordinates before them',
      false,
      { id: 't1', location_latitude: null, location_longitude: null },
    ],
  ])('%s', (_case, migrated, expected) => {
    expect(planImportRows('transactions', [row], context(migrated))).toEqual({
      insert: [{ table: 'transactions', row: expected }],
      patch: [],
      softDelete: [],
    });
  });
});

describe('applyToTables', () => {
  const tables = { wallets: { cash: { id: 'cash', name: 'Cash', deleted: false } } };

  it('writes inserts, patches and soft deletes in one go', () => {
    expect(
      applyToTables(tables, {
        insert: [{ table: 'debts', row: { id: 'd1', user_id: 'user-1', counterparty_name: 'Aina', direction: 'i_owe', currency: 'MYR' } }],
        patch: [{ table: 'debts', id: 'd1', patch: { status: 'settled' } }],
        softDelete: [{ table: 'wallets', id: 'cash', at: NOW }],
      }),
    ).toEqual({
      wallets: { cash: { id: 'cash', name: 'Cash', deleted: true, updated_at: NOW } },
      debts: { d1: { id: 'd1', user_id: 'user-1', counterparty_name: 'Aina', direction: 'i_owe', currency: 'MYR', status: 'settled' } },
    });
  });

  it('writes nothing when a patch has no row', () => {
    expect(() =>
      applyToTables(tables, { insert: [], patch: [{ table: 'wallets', id: 'gone', patch: { name: 'x' } }], softDelete: [] }),
    ).toThrow('Cannot patch missing row: gone');
  });
});

describe('planWalletCreate', () => {
  it('adds the wallet with its starting balance as a decimal, confirmed now, at the given place', () => {
    const wallet = {
      name: 'Maybank Savings',
      type: 'bank' as const,
      currency: 'MYR',
      initialBalanceMinor: minor(228180),
      color: '#F9D51F',
      icon: 'bank',
      cardStyleId: 'citrus-pop',
    };
    expect(planWalletCreate(wallet, context(), 2)).toEqual({
      kind: 'writes',
      writes: {
        insert: [
          {
            table: 'wallets',
            row: {
              id: 'new-1',
              user_id: 'user-1',
              name: 'Maybank Savings',
              type: 'bank',
              currency: 'MYR',
              initial_balance: '2281.80',
              color: '#F9D51F',
              icon: 'bank',
              card_style_id: 'citrus-pop',
              notification_package: null,
              notification_app_label: null,
              notification_account_hint: null,
              balance_confirmed_at: NOW,
              is_active: true,
              display_order: 2,
              deleted: false,
            },
          },
        ],
        patch: [],
        softDelete: [],
      },
      result: 'new-1',
    });
  });
});
