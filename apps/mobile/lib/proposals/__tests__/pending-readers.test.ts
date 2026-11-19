import type { Observable } from '@legendapp/state';

import { financeProjection$, startFinanceProjection } from '@/lib/finance/projection';
import { pendingProposals$ } from '@/lib/finance/selectors';
import { approve, notMine } from '@/lib/proposals/review-actions';
import {
  getLedgerEntries,
  getProposedTransactions,
  listAwaitingReview,
} from '@/lib/supabase/proposed-transactions';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'tx-new' }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/notifications/capture-status', () => ({ markCaptureStatus: jest.fn() }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({}),
    transactions$: observable({}),
    categories$: observable({}),
    categoryBudgets$: observable({}),
    debts$: observable({}),
    debtActivities$: observable({}),
    proposedTransactions$: observable({}),
    autoAddRules$: observable({}),
    assertMigrated: () => {},
    isMigrated: () => true,
  };
});

type Rows = Observable<Record<string, Record<string, unknown>>>;
const { wallets$, transactions$, proposedTransactions$ } = jest.requireMock('@/lib/store') as Record<
  'wallets$' | 'transactions$' | 'proposedTransactions$',
  Rows
>;

const MAYBANK = '00000000-0000-4000-8000-00000000000a';

function seed(id: string, over: Record<string, unknown> = {}) {
  proposedTransactions$[id].set({
    id,
    user_id: 'user-1',
    source_type: 'notification',
    amount: '12.00',
    currency: 'MYR',
    type: 'expense',
    merchant: `M ${id}`,
    wallet_id: MAYBANK,
    status: 'pending',
    created_at: '2026-10-24T04:00:00.000Z',
    updated_at: '2026-10-24T04:00:00.000Z',
    deleted: false,
    ...over,
  });
}

let stop: () => void;

beforeEach(() => {
  wallets$.set({ [MAYBANK]: { id: MAYBANK, user_id: 'user-1', currency: 'MYR', deleted: false } });
  transactions$.set({
    't-ok': {
      id: 't-ok',
      user_id: 'user-1',
      wallet_id: MAYBANK,
      amount: '12.00',
      currency: 'MYR',
      type: 'expense',
      merchant: 'M ok',
      transaction_date: '2026-10-24T04:00:00.000Z',
      deleted: false,
    },
  });
  proposedTransactions$.set({});
  seed('pending');
  // Saved for later by an older app before this build reached it.
  seed('stale', { status: 'later', snoozed_until: '2026-10-26T00:00:00.000Z' });
  seed('ok', { status: 'approved', reviewed_at: '2026-10-24T05:00:00.000Z', transaction_id: 't-ok' });
  seed('no', { status: 'rejected', reviewed_at: '2026-10-24T06:00:00.000Z' });
  stop = startFinanceProjection();
});

afterEach(() => stop());

const sorted = (ids: string[]) => [...ids].sort();

describe('every reader of captures waiting for review skips reviewed history', () => {
  it('pendingProposals$ (Home, Activity, wallet, budget and place pages, chat) holds only unreviewed captures', () => {
    expect(sorted(pendingProposals$('user-1').get().map((p) => p.id))).toEqual(['pending', 'stale']);
  });

  it('the finance projection (chat draft cards, chat answers) has no reviewed captures', () => {
    expect(sorted(Object.keys(financeProjection$.proposalsById.get()))).toEqual(['pending', 'stale']);
  });

  it('the Review deck, proposal waits and notification actions list every unreviewed capture', async () => {
    expect(sorted(listAwaitingReview().map((p) => p.id))).toEqual(['pending', 'stale']);
    expect(sorted((await getProposedTransactions()).map((p) => p.id))).toEqual(['pending', 'stale']);
  });

  it('a Later row an older app stored reads as pending', () => {
    expect(listAwaitingReview().find((p) => p.id === 'stale')?.status).toBe('pending');
  });

  it('duplicate checks and the routine transfer combine see the approved row once, as its transaction', async () => {
    const entries = await getLedgerEntries();
    expect(sorted(entries.map((e) => `${e.kind}:${e.id}`))).toEqual([
      'proposal:pending',
      'proposal:stale',
      'transaction:t-ok',
    ]);
  });

  it('a capture leaves every reader the moment it is approved or marked not mine, and stays stored', async () => {
    const [pending] = listAwaitingReview().filter((p) => p.id === 'pending');
    const [stale] = listAwaitingReview().filter((p) => p.id === 'stale');

    await approve(pending);
    await notMine(stale);

    expect(pendingProposals$('user-1').get()).toEqual([]);
    expect(listAwaitingReview()).toEqual([]);
    expect(proposedTransactions$.pending.peek()).toMatchObject({
      status: 'approved',
      transaction_id: 'tx-new',
      deleted: false,
    });
    expect(proposedTransactions$.stale.peek()).toMatchObject({
      status: 'rejected',
      transaction_id: null,
      deleted: false,
    });
  });

  it('a second Approve of a reviewed capture writes nothing', async () => {
    const [pending] = listAwaitingReview().filter((p) => p.id === 'pending');
    await approve(pending);

    const again = await approve(pending);

    expect(again).toEqual({ status: 'error', message: 'This capture was already reviewed.' });
    expect(sorted(Object.keys(transactions$.peek()))).toEqual(['t-ok', 'tx-new']);
  });
});
