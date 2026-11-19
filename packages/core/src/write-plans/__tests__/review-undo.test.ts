import type { MinorAmount, ProposedTransaction } from '@repo/types';
import { describe, expect, it } from 'vitest';

import type { FinanceTransaction, FinanceWallet } from '../../read-model/types';
import { planCheckIn, correctBalance } from '../balance-correction';
import { applyToTables, type MemoryTables } from '../memory';
import {
  alertKey,
  captureAlert,
  familiarity,
  planCaptureWallet,
  planNotATransfer,
  planReopen,
  planReview,
  similarRule,
  timesFiled,
  usualCaptures,
  type ReviewContext,
} from '../review';
import { planTransactionsDelete, planTransactionsEdit } from '../transactions';
import type { StoredRow } from '../types';
import { undoWrites } from '../undo';

const NOW = '2026-10-14T05:00:00.000Z';
const LATER = '2026-10-14T05:01:00.000Z';
const minor = (value: number) => value as MinorAmount;
const ctx = (reviewHistory = true): ReviewContext => {
  let next = 0;
  return {
    userId: 'user-1',
    now: NOW,
    newId: () => `00000000-0000-4000-8000-00000000000${++next}`,
    isMigrated: () => true,
    reviewHistory,
    autoAddRules: true,
  };
};

const wallet = { id: 'w-1', currency: 'MYR' } as FinanceWallet;
const view = { walletsById: { 'w-1': wallet, 'w-2': { id: 'w-2', currency: 'MYR' } as FinanceWallet }, transactionsById: {}, autoAddRules: [] };
const approve = { kind: 'approve' } as const;

const capture = (over: Partial<ProposedTransaction> = {}): ProposedTransaction => ({
  id: 'p-1',
  userId: 'user-1',
  sourceType: 'notification',
  sourceApp: 'com.maybank2u.life',
  sourceText: null,
  sourceImageUri: null,
  notificationTitle: 'Maybank',
  notificationBody: 'You spent RM23.40 at GRAB*FOOD',
  notificationReceivedAt: '2026-10-14T04:41:00.000Z',
  aiReasoning: null,
  aiConfidence: 0.94,
  walletId: 'w-1',
  walletHint: null,
  transferToWalletId: null,
  transferToWalletHint: null,
  amountMinor: minor(2340),
  currency: 'MYR',
  type: 'expense',
  description: null,
  merchant: 'GRAB*FOOD',
  categoryId: 'c-food',
  categoryHint: null,
  transactionDate: '2026-10-14T04:41:00.000Z',
  createdAt: NOW,
  updatedAt: NOW,
  status: 'pending',
  reviewedAt: null,
  transactionId: null,
  pairing: null,
  ...over,
});

const filed = (merchant: string, over: Partial<FinanceTransaction> = {}) =>
  ({
    type: 'expense',
    currency: 'MYR',
    merchant,
    categoryId: 'c-food',
    analysisExcluded: false,
    debtActivityId: null,
    ...over,
  }) as FinanceTransaction;

describe('familiarity', () => {
  const history = [filed('GRAB*FOOD'), filed('Grab*Food '), filed('GRAB*FOOD'), filed('Jaya Grocer'), filed('GRAB*FOOD', { categoryId: null })];

  it('counts filed rows of the same merchant, type and currency', () => {
    expect(timesFiled(capture(), history)).toBe(3);
    expect(timesFiled(capture({ merchant: 'Jaya Grocer' }), history)).toBe(1);
    expect([3, 1, 0].map(familiarity)).toEqual(['usual', 'seen', null]);
  });

  it('takes only usual captures with a wallet and a category into Approve all usual', () => {
    const picks = usualCaptures(
      [capture(), capture({ id: 'p-2', walletId: null }), capture({ id: 'p-3', merchant: 'Jaya Grocer' })],
      history,
    );
    expect(picks.map((pick) => pick.id)).toEqual(['p-1']);
  });
});

describe('planReview', () => {
  it('Approve writes the ledger row with the alert, closes the capture and marks the capture log added', () => {
    const plan = planReview(capture(), approve, view, ctx());
    expect(plan.kind).toBe('writes');
    if (plan.kind !== 'writes') return;
    expect(plan.writes.insert[0]).toMatchObject({
      table: 'transactions',
      row: {
        wallet_id: 'w-1',
        amount: '23.40',
        merchant: 'GRAB*FOOD',
        category_id: 'c-food',
        metadata: { source: 'notification', alert: { text: 'You spent RM23.40 at GRAB*FOOD', captureId: 'p-1' } },
      },
    });
    expect(plan.writes.patch).toEqual([
      {
        table: 'proposed_transactions',
        id: 'p-1',
        patch: {
          status: 'approved',
          reviewed_at: NOW,
          transaction_id: '00000000-0000-4000-8000-000000000001',
          updated_at: NOW,
        },
      },
    ]);
    expect(plan.writes.softDelete).toEqual([]);
    expect(plan.result).toEqual({
      decision: 'approve',
      transactionId: '00000000-0000-4000-8000-000000000001',
      rule: null,
      captureMarks: [{ captureId: 'p-1', status: 'added', transactionId: '00000000-0000-4000-8000-000000000001' }],
    });
  });

  it('soft-deletes the capture where the server has no review history yet', () => {
    const plan = planReview(capture(), approve, view, ctx(false));
    expect(plan.kind === 'writes' && plan.writes.softDelete).toEqual([{ table: 'proposed_transactions', id: 'p-1', at: NOW }]);
  });

  it('writes what the user changed, with the place the phone saw and the Auto mark', () => {
    const plan = planReview(
      capture({ sourceType: 'text', merchant: 'parking' }),
      {
        kind: 'approve',
        edits: { amountMinor: minor(600), merchant: ' Parking KLCC ', categoryId: 'c-car', walletId: 'w-2' },
        automatically: true,
        place: { latitude: 3.1579, longitude: 101.7116, name: 'KLCC' },
      },
      view,
      ctx(),
    );
    expect(plan.kind === 'writes' && plan.writes.insert[0]!.row).toMatchObject({
      wallet_id: 'w-2',
      amount: '6.00',
      merchant: 'Parking KLCC',
      category_id: 'c-car',
      location_latitude: 3.1579,
      location_longitude: 101.7116,
      location_name: 'KLCC',
      metadata: { source: 'moni', ai_suggested: true },
    });
    expect(plan.kind === 'writes' && plan.result.captureMarks).toEqual([]);
  });

  it('keeps a receipt photo already in storage on the ledger row', () => {
    const photo = 'https://dev.supabase.co/storage/v1/object/public/receipts/user-1/p-1.jpg';
    const stored = planReview(capture({ sourceType: 'image', sourceImageUri: photo }), approve, view, ctx());
    expect(stored.kind === 'writes' && stored.writes.insert[0]!.row).toMatchObject({ receipt_image_url: photo, metadata: { source: 'camera' } });
    const uploading = planReview(capture({ sourceType: 'image', sourceImageUri: 'file:///receipts/p-1.jpg' }), approve, view, ctx());
    expect(uploading.kind === 'writes' && uploading.writes.insert[0]!.row).toMatchObject({ receipt_image_url: null });
  });

  it("Don't ask about similar saves a rule for the app and merchant, or updates the live one", () => {
    const fresh = planReview(capture(), { kind: 'approve', similar: true }, view, ctx());
    expect(fresh.kind === 'writes' && fresh.writes.insert[1]).toEqual({
      table: 'auto_add_rules',
      row: {
        id: '00000000-0000-4000-8000-000000000002',
        user_id: 'user-1',
        merchant_key: 'grab food',
        source_app: 'com.maybank2u.life',
        wallet_id: 'w-1',
        category_id: 'c-food',
        deleted: false,
      },
    });
    expect(fresh.kind === 'writes' && fresh.result.rule).toEqual({ id: '00000000-0000-4000-8000-000000000002', created: true });

    const rules = [
      { id: 'r-old', user_id: 'user-1', merchant_key: 'grab food', source_app: 'com.maybank2u.life', wallet_id: 'w-2', category_id: 'c-x', deleted: false, updated_at: '2026-10-01T00:00:00Z' },
      { id: 'r-new', user_id: 'user-1', merchant_key: 'grab food', source_app: 'com.maybank2u.life', wallet_id: 'w-2', category_id: 'c-y', deleted: false, updated_at: '2026-10-02T00:00:00Z' },
    ] as StoredRow<'auto_add_rules'>[];
    const again = planReview(capture(), { kind: 'approve', similar: true }, { ...view, autoAddRules: rules }, ctx());
    expect(again.kind === 'writes' && again.writes.patch[1]).toEqual({
      table: 'auto_add_rules',
      id: 'r-new',
      patch: { merchant_key: 'grab food', source_app: 'com.maybank2u.life', wallet_id: 'w-1', category_id: 'c-food', updated_at: NOW },
    });
    expect(again.kind === 'writes' && again.result.rule).toEqual({ id: 'r-new', created: false });
  });

  it('saves no rule for a retyped capture, a typed capture, or before the rules table exists', () => {
    expect(similarRule(capture(), { type: 'income' })).toBeNull();
    expect(similarRule(capture({ sourceType: 'image' }))).toBeNull();
    expect(similarRule(capture(), { walletId: 'w-2', merchant: 'Grab*Food Lunch' })).toEqual({
      merchantKey: 'grab food lunch',
      sourceApp: 'com.maybank2u.life',
      walletId: 'w-2',
      categoryId: 'c-food',
    });
    const before = planReview(capture(), { kind: 'approve', similar: true }, view, { ...ctx(), autoAddRules: false });
    expect(before.kind === 'writes' && [before.writes.insert.length, before.result.rule]).toEqual([1, null]);
  });

  it('Not mine closes the capture as rejected and marks it and the alert it absorbed ignored', () => {
    const paired = capture({
      pairing: {
        kind: 'same_payment',
        absorbed: { id: 'p-0', sourceType: 'notification' },
        before: {},
      } as unknown as ProposedTransaction['pairing'],
    });
    expect(planReview(paired, { kind: 'notMine' }, view, ctx())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [{ table: 'proposed_transactions', id: 'p-1', patch: { status: 'rejected', reviewed_at: NOW, transaction_id: null, updated_at: NOW } }],
        softDelete: [],
      },
      result: {
        decision: 'notMine',
        transactionId: null,
        rule: null,
        captureMarks: [
          { captureId: 'p-1', status: 'ignored' },
          { captureId: 'p-0', status: 'ignored' },
        ],
      },
    });
  });

  it('picks a wallet for a capture that needs one', () => {
    expect(planCaptureWallet('p-1', 'w-1', view, ctx())).toEqual({
      kind: 'writes',
      writes: { insert: [], patch: [{ table: 'proposed_transactions', id: 'p-1', patch: { wallet_id: 'w-1', updated_at: NOW } }], softDelete: [] },
      result: null,
    });
    expect(planCaptureWallet('p-1', 'w-9', view, ctx())).toEqual({ kind: 'error', message: 'Wallet not found' });
  });

  it('asks for a wallet or a destination first, and refuses a capture already decided', () => {
    expect(planReview(capture({ walletId: null }), approve, view, ctx())).toEqual({ kind: 'needsInput', field: 'wallet' });
    expect(planReview(capture({ type: 'transfer' }), approve, view, ctx())).toEqual({ kind: 'needsInput', field: 'destination' });
    expect(planReview(capture({ status: 'rejected' }), { kind: 'notMine' }, view, ctx())).toEqual({
      kind: 'error',
      message: 'This capture was already reviewed.',
    });
    expect(planReview(capture(), { kind: 'approve', edits: { amountMinor: minor(0) } }, view, ctx())).toEqual({
      kind: 'error',
      message: 'Enter an amount above zero.',
    });
  });
});

describe('planReopen', () => {
  const row = {
    id: 'p-1',
    user_id: 'user-1',
    source_type: 'notification',
    status: 'pending',
    reviewed_at: null,
    transaction_id: null,
    pairing: null,
    deleted: false,
  } as unknown as StoredRow<'proposed_transactions'>;

  it('puts the capture back, removes the row and a rule the decision made, and marks the log waiting', () => {
    expect(planReopen(row, { transactionId: 't-9', rule: { id: 'r-1', created: true } }, true, { now: LATER })).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [{ table: 'proposed_transactions', id: 'p-1', patch: { status: 'pending', reviewed_at: null, transaction_id: null, updated_at: LATER } }],
        softDelete: [
          { table: 'transactions', id: 't-9', at: LATER },
          { table: 'auto_add_rules', id: 'r-1', at: LATER },
        ],
      },
      result: { captureMarks: [{ captureId: 'p-1', status: 'waiting_for_review' }] },
    });
  });

  it('writes a soft-deleted capture again whole, and keeps a rule that was there before', () => {
    const plan = planReopen({ ...row, source_type: 'image' }, { transactionId: null, rule: { id: 'r-1', created: false } }, false, { now: LATER });
    expect(plan).toEqual({
      kind: 'writes',
      writes: {
        insert: [{ table: 'proposed_transactions', row: { ...row, source_type: 'image', status: 'pending', reviewed_at: null, transaction_id: null, updated_at: LATER, deleted: false } }],
        patch: [],
        softDelete: [],
      },
      result: { captureMarks: [] },
    });
  });

  it('a decision then its reopen leaves the capture as it was', () => {
    const state: MemoryTables = { proposed_transactions: { 'p-1': { ...row } } };
    const plan = planReview(capture(), approve, view, ctx());
    if (plan.kind !== 'writes') throw new Error(plan.kind);
    const after = applyToTables(state, plan.writes);
    const reopen = planReopen(row, plan.result, true, { now: LATER });
    if (reopen.kind !== 'writes') throw new Error(reopen.kind);
    const back = applyToTables(after, reopen.writes);
    expect(back.proposed_transactions!['p-1']).toEqual({ ...row, updated_at: LATER });
    expect(back.transactions!['00000000-0000-4000-8000-000000000001']!.deleted).toBe(true);
  });
});

describe('planNotATransfer', () => {
  it('turns a misread transfer into spending from the alert wallet, or income into the other side', () => {
    const spend = planNotATransfer(capture({ type: 'transfer', transferToWalletId: 'w-2', description: 'To savings' }), { now: NOW });
    expect(spend.kind === 'writes' && spend.writes.patch[0]!.patch).toEqual({
      type: 'expense',
      wallet_id: 'w-1',
      transfer_to_wallet_id: null,
      description: null,
      updated_at: NOW,
    });
    const income = planNotATransfer(capture({ type: 'transfer', walletId: null, transferToWalletId: 'w-2' }), { now: NOW });
    expect(income.kind === 'writes' && income.writes.patch[0]!.patch).toMatchObject({ type: 'income', wallet_id: 'w-2' });
  });
});

describe('undoWrites', () => {
  const tables = (): MemoryTables => ({
    transactions: {
      't-1': { id: 't-1', category_id: 'c-food', wallet_id: 'w-1', deleted: false, updated_at: 'then' },
      't-2': { id: 't-2', category_id: 'c-shop', wallet_id: 'w-1', deleted: false, updated_at: 'then' },
    },
    proposed_transactions: { 'p-1': { id: 'p-1', status: 'pending', reviewed_at: null, transaction_id: null, deleted: false } },
  });
  const beforeOf = (state: MemoryTables) => (table: string, id: string) =>
    (state as Record<string, Record<string, Record<string, unknown>>>)[table]?.[id];

  it('puts a bulk category change back row by row', () => {
    const state = tables();
    const plan = planTransactionsEdit(
      ['t-1', 't-2'],
      { categoryId: '11111111-1111-4111-8111-111111111111' },
      { walletsById: {}, transactionsById: {} },
      ctx(),
    );
    if (plan.kind !== 'writes') throw new Error(plan.kind);
    const after = applyToTables(state, plan.writes);
    const back = applyToTables(after, undoWrites(plan.writes, beforeOf(state), LATER));
    expect(back.transactions!['t-1']).toMatchObject({ category_id: 'c-food', updated_at: LATER });
    expect(back.transactions!['t-2']).toMatchObject({ category_id: 'c-shop', updated_at: LATER });
  });

  it('brings soft-deleted rows back live', () => {
    const state = tables();
    const plan = planTransactionsDelete(['t-1'], { now: NOW });
    if (plan.kind !== 'writes') throw new Error(plan.kind);
    const undo = undoWrites(plan.writes, beforeOf(state), LATER);
    expect(undo.insert).toEqual([
      { table: 'transactions', row: { id: 't-1', category_id: 'c-food', wallet_id: 'w-1', deleted: false, updated_at: LATER } },
    ]);
    expect(applyToTables(applyToTables(state, plan.writes), undo).transactions!['t-1']!.deleted).toBe(false);
  });

  it('takes an approval back: the new row goes and the capture waits again', () => {
    const state = tables();
    const plan = planReview(capture(), approve, view, ctx());
    if (plan.kind !== 'writes') throw new Error(plan.kind);
    const undo = undoWrites(plan.writes, beforeOf(state), LATER);
    expect(undo.softDelete).toEqual([{ table: 'transactions', id: '00000000-0000-4000-8000-000000000001', at: LATER }]);
    expect(undo.patch).toEqual([
      {
        table: 'proposed_transactions',
        id: 'p-1',
        patch: { updated_at: LATER, status: 'pending', reviewed_at: null, transaction_id: null },
      },
    ]);
  });
});

describe('planCheckIn', () => {
  it("marks the balance seen for That's right", () => {
    expect(planCheckIn('w-1', null, view, ctx())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [{ table: 'wallets', id: 'w-1', patch: { balance_confirmed_at: NOW, updated_at: NOW } }],
        softDelete: [],
      },
      result: { id: null },
    });
  });

  it('adds a balance correction for Fix it', () => {
    const plan = planCheckIn('w-1', correctBalance({ balance: 2281.8 }, 2270), view, ctx());
    expect(plan.kind === 'writes' && plan.writes.insert[0]).toMatchObject({
      table: 'transactions',
      row: { type: 'expense', amount: '11.80', analysis_excluded: true, description: 'Balance correction' },
    });
  });
});

describe('captureAlert', () => {
  const delivery = {
    sourceType: 'notification' as const,
    sourceApp: 'com.maybank2u.life',
    notificationTitle: 'Maybank',
    notificationBody: '  You spent RM23.40 at GRAB*FOOD  ',
    notificationReceivedAt: '2026-10-14T05:00:00.000Z',
    amountMinor: minor(2340),
    currency: 'MYR',
  };

  it('keys one delivery by its instant, whatever format the timestamp comes back in', () => {
    expect(alertKey(delivery)).toBe('["com.maybank2u.life","Maybank","  You spent RM23.40 at GRAB*FOOD  ",1791954000000]');
    expect(alertKey({ ...delivery, notificationReceivedAt: '2026-10-14T13:00:00+08:00' })).toBe(alertKey(delivery));
  });

  it('keeps the trimmed alert with the capture it came from, and nothing for a typed capture', () => {
    expect(captureAlert(delivery, 'p-1')).toEqual({
      text: 'You spent RM23.40 at GRAB*FOOD',
      amountMinor: 2340,
      currency: 'MYR',
      key: alertKey(delivery),
      captureId: 'p-1',
    });
    expect(captureAlert({ ...delivery, sourceType: 'text' })).toBeUndefined();
  });
});
