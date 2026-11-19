import type { MinorAmount, ProposedTransaction } from '@repo/types';
import { describe, expect, it } from 'vitest';

import type { FinanceTransaction, FinanceWallet } from '../../read-model/types';
import { planCheckIn, correctBalance } from '../balance-correction';
import { applyToTables, type MemoryTables } from '../memory';
import { familiarity, planApprove, planCaptureWallet, timesFiled, usualCaptures } from '../review';
import { planTransactionsDelete, planTransactionsEdit } from '../transactions';
import type { PlanContext } from '../types';
import { undoWrites } from '../undo';

const NOW = '2026-10-14T05:00:00.000Z';
const LATER = '2026-10-14T05:01:00.000Z';
const minor = (value: number) => value as MinorAmount;
const ctx = (reviewHistory = true): PlanContext & { reviewHistory: boolean } => ({
  userId: 'user-1',
  now: NOW,
  newId: () => '00000000-0000-4000-8000-000000000001',
  isMigrated: () => true,
  reviewHistory,
});

const wallet = { id: 'w-1', currency: 'MYR' } as FinanceWallet;
const view = { walletsById: { 'w-1': wallet }, transactionsById: {} };

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
  snoozedUntil: null,
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

describe('planApprove', () => {
  it('writes the ledger row with the alert and closes the capture as approved', () => {
    const plan = planApprove(capture(), view, ctx());
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
  });

  it('soft-deletes the capture where the server has no review history yet', () => {
    const plan = planApprove(capture(), view, ctx(false));
    expect(plan.kind === 'writes' && plan.writes.softDelete).toEqual([{ table: 'proposed_transactions', id: 'p-1', at: NOW }]);
  });

  it('picks a wallet for a capture that needs one', () => {
    expect(planCaptureWallet('p-1', 'w-1', view, ctx())).toEqual({
      kind: 'writes',
      writes: { insert: [], patch: [{ table: 'proposed_transactions', id: 'p-1', patch: { wallet_id: 'w-1', updated_at: NOW } }], softDelete: [] },
      result: null,
    });
    expect(planCaptureWallet('p-1', 'w-9', view, ctx())).toEqual({ kind: 'error', message: 'Wallet not found' });
  });

  it('asks for a wallet first, and refuses a capture already decided', () => {
    expect(planApprove(capture({ walletId: null }), view, ctx())).toEqual({ kind: 'needsInput', field: 'wallet' });
    expect(planApprove(capture({ status: 'approved' }), view, ctx())).toEqual({
      kind: 'error',
      message: 'This capture was already reviewed.',
    });
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
    const plan = planApprove(capture(), view, ctx());
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
