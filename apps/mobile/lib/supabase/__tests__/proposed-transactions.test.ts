import type { Observable } from '@legendapp/state';
import {
  commitReview,
  getProposedTransactions,
  listAwaitingReview,
  listRecentlyReviewed,
  pruneReviewHistory,
} from '../proposed-transactions';

const reject = (id: string) =>
  commitReview(listAwaitingReview().find((proposal) => proposal.id === id)!, { kind: 'notMine' });

jest.mock('expo-crypto', () => ({ randomUUID: () => 'tx-1' }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/notifications/capture-status', () => ({ markCaptureStatus: jest.fn() }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({ w1: { id: 'w1', currency: 'MYR', deleted: false } }),
    debts$: observable({}),
    debtActivities$: observable({}),
    transactions$: observable({}),
    proposedTransactions$: observable({}),
    autoAddRules$: observable({}),
    assertMigrated: () => {},
    isMigrated: jest.fn(() => true),
  };
});

const { proposedTransactions$, transactions$, isMigrated } = jest.requireMock('@/lib/store') as {
  proposedTransactions$: Observable<Record<string, Record<string, unknown>>>;
  transactions$: Observable<Record<string, Record<string, unknown>>>;
  isMigrated: jest.Mock;
};
const { markCaptureStatus } = jest.requireMock('@/lib/notifications/capture-status') as {
  markCaptureStatus: jest.Mock;
};

const NOW = new Date('2026-10-14T10:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

beforeEach(() => {
  proposedTransactions$.set({});
  transactions$.set({});
});

function seed(id: string, over: Record<string, unknown>) {
  proposedTransactions$[id].set({
    id,
    user_id: 'user-1',
    source_type: 'notification',
    amount: '12.00',
    currency: 'MYR',
    type: 'expense',
    merchant: 'KEDAI ABC',
    status: 'pending',
    created_at: '2026-10-14T09:00:00.000Z',
    deleted: false,
    ...over,
  });
}

describe('Review', () => {
  it('lists every unreviewed capture, a Later row an older app stored among them, as pending', async () => {
    seed('pending', {});
    seed('stale', { status: 'later', snoozed_until: new Date(NOW.getTime() + HOUR).toISOString() });
    seed('done', { status: 'approved', reviewed_at: daysAgo(0.1) });

    const waiting = (await getProposedTransactions()).map((p) => [p.id, p.status]).sort();

    expect(waiting).toEqual([
      ['pending', 'pending'],
      ['stale', 'pending'],
    ]);
  });
});

describe('Not mine', () => {
  it('keeps the row as review history, stamped rejected with no ledger row', async () => {
    jest.useFakeTimers({ now: NOW });
    seed('p2', {});

    await reject('p2');
    jest.useRealTimers();

    expect(proposedTransactions$.p2.peek()).toMatchObject({
      status: 'rejected',
      reviewed_at: '2026-10-14T10:00:00.000Z',
      transaction_id: null,
      deleted: false,
    });
    expect(listAwaitingReview()).toEqual([]);
  });

  it('soft-deletes the row as before while the review_history migration is not pushed', async () => {
    isMigrated.mockReturnValueOnce(false);
    seed('p2', {});
    const statuses: unknown[] = [];
    const stop = proposedTransactions$.p2.status.onChange(({ value }) => statuses.push(value));

    await reject('p2');
    stop();

    expect(statuses).toEqual(['rejected']);
    expect(proposedTransactions$.peek().p2).toMatchObject({ status: 'rejected', deleted: true });
    expect(listAwaitingReview()).toEqual([]);
  });

  it('marks the capture log entry of a notification proposal Ignored', async () => {
    markCaptureStatus.mockClear();
    seed('from-alert', {});
    seed('from-chat', { source_type: 'text' });

    await reject('from-alert');
    await reject('from-chat');

    expect(markCaptureStatus.mock.calls).toEqual([['from-alert', 'ignored']]);
  });
});

describe('Approve', () => {
  it('keeps the row with the id of the ledger row it created', async () => {
    seed('p3', {});
    const [proposal] = listAwaitingReview();

    const { transactionId } = await commitReview(proposal, { kind: 'approve', edits: { walletId: 'w1' } });

    expect(transactionId).toBe('tx-1');
    expect(proposedTransactions$.p3.peek()).toMatchObject({
      status: 'approved',
      transaction_id: 'tx-1',
      deleted: false,
    });
    expect(transactions$['tx-1'].peek()).toMatchObject({ amount: '12.00', deleted: false });
  });
});

describe('Recently reviewed', () => {
  it('lists Approve and Not mine decisions of the last 30 days, newest first', () => {
    seed('pending', {});
    seed('yesterday', { status: 'approved', reviewed_at: daysAgo(1), transaction_id: 'tx-9' });
    seed('today', { status: 'rejected', reviewed_at: daysAgo(0.1) });
    seed('day-29', { status: 'rejected', reviewed_at: daysAgo(29) });
    seed('day-31', { status: 'approved', reviewed_at: daysAgo(31) });

    expect(listRecentlyReviewed(NOW).map((p) => [p.id, p.status, p.transactionId])).toEqual([
      ['today', 'rejected', null],
      ['yesterday', 'approved', 'tx-9'],
      ['day-29', 'rejected', null],
    ]);
  });
});

describe('review history retention', () => {
  it('soft-deletes decisions older than 90 days and finds nothing on a second run', () => {
    seed('pending', { created_at: daysAgo(120) });
    seed('day-89', { status: 'approved', reviewed_at: daysAgo(89) });
    seed('day-91', { status: 'rejected', reviewed_at: daysAgo(91) });
    seed('day-200', { status: 'approved', reviewed_at: daysAgo(200) });

    expect(pruneReviewHistory(NOW)).toBe(2);
    expect(pruneReviewHistory(NOW)).toBe(0);

    expect(Object.keys(proposedTransactions$.peek()).sort()).toEqual(['day-89', 'pending']);
  });
});
