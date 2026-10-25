import type { Observable } from '@legendapp/state';
import {
  approveProposedTransaction,
  getProposedTransactions,
  isAwaitingReview,
  laterProposedTransaction,
  listAwaitingReview,
  listRecentlyReviewed,
  pruneReviewHistory,
  rejectProposedTransaction,
} from '../proposed-transactions';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'tx-1' }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/notifications/capture-status', () => ({ markCaptureStatus: jest.fn() }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({ w1: { id: 'w1', currency: 'MYR', deleted: false } }),
    transactions$: observable({}),
    proposedTransactions$: observable({}),
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

describe('Later', () => {
  it('hides a snoozed proposal until its snooze passes', () => {
    const inAnHour = new Date(NOW.getTime() + HOUR).toISOString();
    const anHourAgo = new Date(NOW.getTime() - HOUR).toISOString();
    expect(isAwaitingReview({ status: 'later', snoozedUntil: inAnHour }, NOW)).toBe(false);
    expect(isAwaitingReview({ status: 'later', snoozedUntil: anHourAgo }, NOW)).toBe(true);
    expect(isAwaitingReview({ status: 'pending', snoozedUntil: null }, NOW)).toBe(true);
    expect(isAwaitingReview({ status: 'rejected', snoozedUntil: null }, NOW)).toBe(false);
  });

  it('review lists pending rows and Later rows that are due, not ones still snoozed', async () => {
    seed('pending', {});
    seed('due', { status: 'later', snoozed_until: new Date(NOW.getTime() - HOUR).toISOString() });
    seed('snoozed', {
      status: 'later',
      snoozed_until: new Date(NOW.getTime() + HOUR).toISOString(),
    });

    const ids = (await getProposedTransactions(NOW)).map((p) => p.id).sort();

    expect(ids).toEqual(['due', 'pending']);
  });

  it('laterProposedTransaction stores the status and the snooze end', () => {
    seed('p1', {});
    laterProposedTransaction('p1', new Date(NOW.getTime() + HOUR));
    expect(proposedTransactions$.p1.peek()).toMatchObject({
      status: 'later',
      snoozed_until: '2026-10-14T11:00:00.000Z',
    });
  });
});

describe('Not mine', () => {
  it('keeps the row as review history, stamped rejected with no ledger row', async () => {
    jest.useFakeTimers({ now: NOW });
    seed('p2', {});

    await rejectProposedTransaction('p2');
    jest.useRealTimers();

    expect(proposedTransactions$.p2.peek()).toMatchObject({
      status: 'rejected',
      reviewed_at: '2026-10-14T10:00:00.000Z',
      transaction_id: null,
      deleted: false,
    });
    expect(listAwaitingReview(NOW)).toEqual([]);
  });

  it('soft-deletes the row as before while the review_history migration is not pushed', async () => {
    isMigrated.mockReturnValueOnce(false);
    seed('p2', {});
    const statuses: unknown[] = [];
    const stop = proposedTransactions$.p2.status.onChange(({ value }) => statuses.push(value));

    await rejectProposedTransaction('p2');
    stop();

    expect(statuses).toEqual(['rejected']);
    expect(proposedTransactions$.peek().p2).toBeUndefined();
  });

  it('marks the capture log entry of a notification proposal Ignored', async () => {
    markCaptureStatus.mockClear();
    seed('from-alert', {});
    seed('from-chat', { source_type: 'text' });

    await rejectProposedTransaction('from-alert');
    await rejectProposedTransaction('from-chat');

    expect(markCaptureStatus.mock.calls).toEqual([['from-alert', 'ignored']]);
  });
});

describe('Approve', () => {
  it('keeps the row with the id of the ledger row it created', async () => {
    seed('p3', {});
    const [proposal] = listAwaitingReview(NOW);

    const transactionId = await approveProposedTransaction(proposal, { walletId: 'w1' });

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
    seed('snoozed', { status: 'later', snoozed_until: daysAgo(-1) });
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
