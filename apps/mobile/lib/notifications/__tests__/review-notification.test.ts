import type { Observable } from '@legendapp/state';
import { Platform } from 'react-native';

import {
  handleReviewNotificationTask,
  postReviewNotification,
} from '../review-notification';

let mockNextId = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `00000000-0000-4000-8000-${String(++mockNextId).padStart(12, '0')}`,
}));
jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  AndroidImportance: { HIGH: 5, DEFAULT: 3 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationCategoryAsync: jest.fn(async () => null),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  dismissNotificationAsync: jest.fn(async () => {}),
  getPresentedNotificationsAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/supabase/client', () => ({
  getUserId: async () => 'user-1',
  supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) } },
}));
jest.mock('@/lib/notifications/capture-status', () => ({ markCaptureStatus: jest.fn() }));
jest.mock('@/lib/notifications/installed-apps', () => ({
  getCachedInstalledAppsMap: () => new Map([['com.maybank2u.life', { label: 'Maybank' }]]),
}));
jest.mock('@/lib/store/auth-sync', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return { authReady$: observable(false) };
});
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  const tables = {
    wallets$: observable({}),
    transactions$: observable({}),
    categories$: observable({}),
    categoryBudgets$: observable({}),
    debts$: observable({}),
    debtActivities$: observable({}),
    proposedTransactions$: observable({}),
    autoAddRules$: observable({}),
    merchantAliases$: observable({}),
  };
  return {
    ...tables,
    ALL_STORE_OBSERVABLES: Object.values(tables),
    enableStoreSync: jest.fn(async () => {}),
    assertMigrated: () => {},
    isMigrated: () => true,
  };
});

type Rows = Observable<Record<string, Record<string, unknown>>>;
const store = jest.requireMock('@/lib/store') as Record<string, Rows> & {
  enableStoreSync: jest.Mock;
};
const notifications = jest.requireMock('expo-notifications') as Record<string, jest.Mock>;

const MAYBANK = '00000000-0000-4000-8000-00000000000a';
const FOOD = '00000000-0000-4000-8000-0000000000f0';

function seed(over: Record<string, unknown> = {}) {
  store.proposedTransactions$.p1.set({
    id: 'p1',
    user_id: 'user-1',
    source_type: 'notification',
    source_app: 'com.maybank2u.life',
    amount: '12.00',
    currency: 'MYR',
    type: 'expense',
    merchant: 'GRAB',
    wallet_id: MAYBANK,
    category_id: FOOD,
    notification_body: "MAYBANK: You've spent RM12.00 at GRAB on 14/10 12:41.",
    status: 'pending',
    created_at: '2026-10-14T04:41:00.000Z',
    deleted: false,
    ...over,
  });
}

/** Runs a tap to the end, including the 8 s that Approved stays up. */
async function tap(actionIdentifier: string, data: Record<string, unknown>) {
  const done = handleReviewNotificationTask({
    data: { actionIdentifier, notification: { request: { content: { data } } } },
  });
  await jest.advanceTimersByTimeAsync(9000);
  await done;
}

const ledger = () =>
  Object.values(store.transactions$.peek()).filter((row) => row.deleted === false);
const lastShown = () => notifications.scheduleNotificationAsync.mock.calls.at(-1)?.[0];

beforeAll(() => {
  Platform.OS = 'android';
});

beforeEach(() => {
  jest.useFakeTimers();
  Object.values(notifications).forEach((fn) => typeof fn === 'function' && fn.mockClear?.());
  store.proposedTransactions$.set({});
  store.transactions$.set({});
  store.autoAddRules$.set({});
  store.wallets$.set({ [MAYBANK]: { id: MAYBANK, currency: 'MYR', deleted: false } });
  store.categories$.set({ [FOOD]: { id: FOOD, name: 'Food & Dining', deleted: false } });
});

afterEach(() => jest.useRealTimers());

describe('review notification', () => {
  it('posts GRAB · −RM12.00 from Maybank with the alert, the category and the review actions', async () => {
    seed();
    await postReviewNotification('p1');
    expect(lastShown()).toEqual({
      identifier: 'review-p1',
      content: {
        title: 'GRAB · \u2212RM12.00',
        subtitle: 'Maybank',
        body: "MAYBANK: You've spent RM12.00 at GRAB on 14/10 12:41.\nMoni: Food & Dining.",
        color: '#236B47',
        data: { kind: 'review', proposalId: 'p1' },
        categoryIdentifier: 'moni-review',
      },
      trigger: { channelId: 'moni-review-first' },
    });
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'moni-review',
      expect.objectContaining({ lockscreenVisibility: 0 }),
    );

    const filed = (id: string, merchant: string) => ({
      id,
      user_id: 'user-1',
      merchant,
      category_id: FOOD,
      deleted: false,
    });
    store.transactions$.set({ t1: filed('t1', 'GRAB'), t2: filed('t2', 'Grab'), t3: filed('t3', 'KFC') });
    await postReviewNotification('p1');
    expect(lastShown().trigger).toEqual({ channelId: 'moni-review' });
    expect(lastShown().content.body).toBe(
      "MAYBANK: You've spent RM12.00 at GRAB on 14/10 12:41.\nMoni: Food & Dining, like the last 2 times.",
    );
  });

  it('Approve with the app killed turns sync on, writes the ledger row, and shows Approved with Undo for 8 s', async () => {
    seed();
    notifications.getPresentedNotificationsAsync.mockResolvedValueOnce([
      { request: { identifier: 'review-p1', content: { data: { kind: 'decided' } } } },
    ]);
    await tap('approve', { kind: 'review', proposalId: 'p1' });

    expect(store.enableStoreSync).toHaveBeenCalled();
    expect(ledger()).toEqual([
      expect.objectContaining({ merchant: 'GRAB', amount: '12.00', wallet_id: MAYBANK }),
    ]);
    const approved = lastShown();
    expect(approved.content).toMatchObject({
      title: 'Approved GRAB \u2212RM12.00',
      body: 'No budget for Food & Dining yet',
      categoryIdentifier: 'moni-review-approved',
    });
    expect(notifications.dismissNotificationAsync).toHaveBeenLastCalledWith('review-p1');

    await tap('undo', approved.content.data);
    expect(ledger()).toEqual([]);
    expect(store.proposedTransactions$.p1.status.peek()).toBe('pending');
    expect(lastShown().content.categoryIdentifier).toBe('moni-review');
  });

  it("Don't ask about similar after Approve adds the merchant's rule and says what Moni does now", async () => {
    seed();
    await tap('approve', { kind: 'review', proposalId: 'p1' });
    await tap('similar', lastShown().content.data);
    expect(Object.values(store.autoAddRules$.peek())).toEqual([
      expect.objectContaining({ merchant_key: 'grab', wallet_id: MAYBANK, category_id: FOOD }),
    ]);
    expect(lastShown().content).toMatchObject({
      title: 'Approved GRAB \u2212RM12.00',
      body: 'Moni adds GRAB alerts like this without asking and marks them Auto.',
      categoryIdentifier: 'moni-review-decided',
    });
  });

  it('Not mine and Later show what happened with Undo for 8 s, and Undo brings the capture back', async () => {
    seed();
    await tap('later', { kind: 'review', proposalId: 'p1' });
    expect(store.proposedTransactions$.p1.status.peek()).toBe('later');
    expect(lastShown().content).toMatchObject({
      title: 'Saved for later',
      body: 'It waits in Review and does not count yet.',
      categoryIdentifier: 'moni-review-decided',
    });

    seed();
    notifications.getPresentedNotificationsAsync.mockResolvedValueOnce([
      { request: { identifier: 'review-p1', content: { data: { kind: 'decided' } } } },
    ]);
    await tap('not-mine', { kind: 'review', proposalId: 'p1' });
    expect(store.proposedTransactions$.p1.status.peek()).toBe('rejected');
    expect(ledger()).toEqual([]);
    const notMine = lastShown();
    expect(notMine.content).toMatchObject({ title: '1 not mine', body: 'Nothing was added.' });
    expect(notifications.dismissNotificationAsync).toHaveBeenLastCalledWith('review-p1');

    await tap('undo', notMine.content.data);
    expect(store.proposedTransactions$.p1.status.peek()).toBe('pending');
    expect(lastShown().content.categoryIdentifier).toBe('moni-review');
  });

  it('Approve on a capture with no wallet writes nothing and asks for a tap', async () => {
    seed({ wallet_id: null });
    store.wallets$.set({});
    await tap('approve', { kind: 'review', proposalId: 'p1' });
    expect(ledger()).toEqual([]);
    expect(lastShown().content).toMatchObject({ title: 'Pick a wallet in Moni' });
  });
});
