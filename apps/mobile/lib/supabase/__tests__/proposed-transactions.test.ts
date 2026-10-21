import type { Observable } from '@legendapp/state';
import {
  getProposedTransactions,
  isAwaitingReview,
  laterProposedTransaction,
  rejectProposedTransaction,
} from '../proposed-transactions';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'id' }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/notifications/capture-status', () => ({ markCaptureStatus: jest.fn() }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({}),
    transactions$: observable({}),
    proposedTransactions$: observable({}),
    assertTableMigrated: () => {},
  };
});

const { proposedTransactions$ } = jest.requireMock('@/lib/store') as {
  proposedTransactions$: Observable<Record<string, Record<string, unknown>>>;
};
const { markCaptureStatus } = jest.requireMock('@/lib/notifications/capture-status') as {
  markCaptureStatus: jest.Mock;
};

const NOW = new Date('2026-10-14T10:00:00.000Z');
const HOUR = 60 * 60 * 1000;

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
  it('stamps the row rejected and soft-deletes it', async () => {
    seed('p2', {});
    const statuses: unknown[] = [];
    const stop = proposedTransactions$.p2.status.onChange(({ value }) => statuses.push(value));

    await rejectProposedTransaction('p2');
    stop();

    expect(statuses).toEqual(['rejected']);
    expect(await getProposedTransactions(NOW)).not.toContainEqual(
      expect.objectContaining({ id: 'p2' }),
    );
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
