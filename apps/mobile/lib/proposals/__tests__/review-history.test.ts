import type { Observable } from '@legendapp/state';

import { pruneReviewHistoryDaily } from '../review-history';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'id' }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/notifications/capture-status', () => ({ markCaptureStatus: jest.fn() }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({}),
    transactions$: observable({}),
    proposedTransactions$: observable({}),
    assertMigrated: () => {},
    isMigrated: () => true,
  };
});

const { proposedTransactions$ } = jest.requireMock('@/lib/store') as {
  proposedTransactions$: Observable<Record<string, Record<string, unknown>>>;
};

function reviewedOn(id: string, reviewedAt: string) {
  proposedTransactions$[id].set({
    id,
    user_id: 'user-1',
    source_type: 'notification',
    amount: '12.00',
    currency: 'MYR',
    type: 'expense',
    status: 'rejected',
    reviewed_at: reviewedAt,
    created_at: reviewedAt,
    deleted: false,
  });
}

const ids = () => Object.keys(proposedTransactions$.peek()).sort();

it('drops decisions older than 90 days once a day, and again the next day', () => {
  reviewedOn('jul-20', '2026-07-20T04:00:00.000Z');
  reviewedOn('aug-01', '2026-08-01T04:00:00.000Z');

  expect(pruneReviewHistoryDaily(new Date(2026, 9, 25, 9, 0))).toBe(1);
  expect(ids()).toEqual(['aug-01']);

  reviewedOn('jul-01', '2026-07-01T04:00:00.000Z');
  expect(pruneReviewHistoryDaily(new Date(2026, 9, 25, 21, 0))).toBe(0);
  expect(ids()).toEqual(['aug-01', 'jul-01']);

  expect(pruneReviewHistoryDaily(new Date(2026, 9, 31, 9, 0))).toBe(2);
  expect(ids()).toEqual([]);
});
