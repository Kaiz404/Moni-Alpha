import { createMMKV } from 'react-native-mmkv';

import type { ExtractResult } from '@/lib/ai/client/types';
import { getAiClient } from '@/lib/ai/client';
import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import {
  enqueue,
  getAll,
  markProcessing,
  pruneCompleted,
  type NotificationQueueItem,
} from '@/lib/ai/processing-queue';
import { readCaptureHealth, sourceHealth } from '@/lib/notifications/capture-health';
import { postReviewNotification } from '@/lib/notifications/review-notification';

import {
  delivered,
  ledgerRows,
  MAYBANK,
  MAYBANK_APP,
  MINUTE,
  mockModel,
  openProposals,
  resetStore,
  T0,
  TNG,
  TNG_APP,
  wallet,
} from './pairing-fixture';

const mockService = { running: false };
let mockNextId = 0;

jest.mock('expo-crypto', () => ({
  randomUUID: () => `00000000-0000-4000-a000-${String(++mockNextId).padStart(12, '0')}`,
}));
jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string>>();
  return {
    createMMKV: ({ id }: { id: string }) => {
      const store = stores.get(id) ?? new Map<string, string>();
      stores.set(id, store);
      return {
        set: (key: string, value: string) => store.set(key, value),
        getString: (key: string) => store.get(key),
        remove: (key: string) => store.delete(key),
      };
    },
  };
});
jest.mock('react-native-background-actions', () => ({
  __esModule: true,
  default: {
    isRunning: () => mockService.running,
    start: async (task: (data: unknown) => Promise<void>, options: { parameters: unknown }) => {
      mockService.running = true;
      void task(options.parameters);
    },
    stop: async () => {
      mockService.running = false;
    },
  },
}));
jest.mock('expo-linking', () => ({ resolveScheme: () => 'moni' }));
jest.mock('@/lib/ai/client', () => ({ getAiClient: jest.fn() }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/notifications/review-notification', () => ({
  postReviewNotification: jest.fn(async () => {}),
}));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({}),
    transactions$: observable({}),
    categories$: observable({}),
    proposedTransactions$: observable({}),
    autoAddRules$: observable({}),
    assertMigrated: () => {},
    isMigrated: () => true,
  };
});

const BANK_ALERT = "MAYBANK: You've spent RM15.90 at TNG DIGITAL on 14/10 12:41.";
const TNG_ALERT = 'Payment of RM15.90 to GUARDIAN was successful.';
const BANK_RELOAD = "MAYBANK: RM100.00 transferred to Touch 'n Go eWallet on 14/10 12:41.";
const TNG_RELOAD = 'Reload of RM100.00 via Online Banking was successful.';

const bank = () =>
  delivered(MAYBANK_APP, BANK_ALERT, { amount: 15.9, type: 'expense', merchant: 'TNG DIGITAL' });
const ewallet = (minutes = 1) =>
  delivered(TNG_APP, TNG_ALERT, { amount: 15.9, type: 'expense', merchant: 'GUARDIAN' }, minutes);
const bankReload = () =>
  delivered(MAYBANK_APP, BANK_RELOAD, {
    amount: 100,
    type: 'expense',
    merchant: "Touch 'n Go eWallet",
  });
const tngReload = () =>
  delivered(TNG_APP, TNG_RELOAD, { amount: 100, type: 'income', merchant: null }, 1);

const HOUR = 60 * MINUTE;
const LOG_KEY = 'captured_notifications';
const notifications = createMMKV({ id: 'moni-notifications' });
const ONE_PAYMENT = { wallet_id: MAYBANK, merchant: 'GUARDIAN', amount: '15.90', type: 'expense' };

type LogEntry = {
  id: string;
  status: string;
  transactionId?: string;
  pairedProposalId?: string;
};

function capture(item: NotificationQueueItem) {
  const list = JSON.parse(notifications.getString(LOG_KEY) ?? '[]');
  list.unshift({
    ...item.notification,
    id: item.id,
    packageLinked: true,
    status: 'waiting_for_review',
  });
  notifications.set(LOG_KEY, JSON.stringify(list));
  enqueue(item);
}

function logEntry(id: string): LogEntry {
  const list = JSON.parse(notifications.getString(LOG_KEY) ?? '[]') as LogEntry[];
  const { status, transactionId, pairedProposalId } = list.find((entry) => entry.id === id)!;
  return { id, status, transactionId, pairedProposalId };
}

const queueState = (id: string) => {
  const item = getAll().find((entry) => entry.id === id)!;
  return { status: item.status, attempts: item.attempts ?? 0 };
};

const lastCaptured = (packageName: string) =>
  sourceHealth(readCaptureHealth(), packageName).lastCapturedAt;

function backendDownFor(...texts: string[]) {
  const working = (getAiClient as jest.Mock)();
  const extract = jest.fn(async (request: { notification: { text: string } }): Promise<ExtractResult> => {
    if (texts.includes(request.notification.text)) {
      return { status: 'unavailable', reason: 'AI backend error (503)' };
    }
    return working.extractFromNotification(request);
  });
  (getAiClient as jest.Mock).mockReturnValue({ extractFromNotification: extract });
  return extract;
}

/** The processor waits 500ms before it starts, and 200ms between items. */
const drain = () => jest.advanceTimersByTimeAsync(1_000);

async function run() {
  await startBackgroundProcessor();
  await drain();
}

const pairingOf = (row: Record<string, unknown>) =>
  (row.pairing as { kind: string; absorbed: { id: string } } | null) ?? null;

beforeEach(() => {
  jest.useFakeTimers({ now: T0 + 2 * MINUTE });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.clearAllMocks();
  mockService.running = false;
  notifications.remove(LOG_KEY);
  notifications.remove('capture_health');
  pruneCompleted();
  mockModel();
  resetStore([
    wallet(MAYBANK, 'Maybank', 'bank', MAYBANK_APP),
    wallet(TNG, "Touch 'n Go", 'ewallet', TNG_APP),
  ]);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('an alert the backend could not read, with another alert for the same payment', () => {
  it.each([
    ['30 seconds later, on the backoff', 30_000, false],
    ['six hours later, when the app opens', 6 * HOUR, true],
  ])('a retried bank alert pairs with the e-wallet alert %s', async (_when, waitMs, kick) => {
    const first = ewallet();
    capture(first);
    await run();
    expect(openProposals().map((row) => row.id)).toEqual([first.id]);

    const retried = bank();
    capture(retried);
    backendDownFor(BANK_ALERT);
    await run();
    expect(logEntry(retried.id)).toEqual({ id: retried.id, status: 'trying_again' });
    expect(queueState(retried.id)).toEqual({ status: 'pending', attempts: 1 });
    expect(openProposals()).toHaveLength(1);
    expect(pairingOf(openProposals()[0]!)).toBeNull();

    mockModel();
    await jest.advanceTimersByTimeAsync(waitMs);
    if (kick) await startBackgroundProcessor();
    await drain();

    expect(ledgerRows()).toEqual([]);
    const [row] = openProposals();
    expect(openProposals()).toHaveLength(1);
    expect(row).toMatchObject({ id: first.id, ...ONE_PAYMENT });
    expect(pairingOf(row!)).toMatchObject({
      kind: 'same_purchase',
      absorbed: { id: retried.id },
    });
    expect(logEntry(retried.id)).toEqual({
      id: retried.id,
      status: 'same_payment',
      pairedProposalId: first.id,
    });
    expect(logEntry(first.id)).toEqual({ id: first.id, status: 'waiting_for_review' });
    expect(queueState(retried.id)).toEqual({ status: 'done', attempts: 1 });
    expect(postReviewNotification).toHaveBeenCalledTimes(1);
    expect(postReviewNotification).toHaveBeenCalledWith(first.id);
  });

  it('a retried e-wallet alert pairs with the bank alert the same way', async () => {
    const first = bank();
    capture(first);
    await run();

    const retried = ewallet();
    capture(retried);
    backendDownFor(TNG_ALERT);
    await run();
    expect(logEntry(retried.id).status).toBe('trying_again');

    mockModel();
    await run();

    expect(openProposals()).toHaveLength(1);
    expect(openProposals()[0]).toMatchObject({ id: first.id, ...ONE_PAYMENT });
    expect(logEntry(retried.id)).toEqual({
      id: retried.id,
      status: 'same_payment',
      pairedProposalId: first.id,
    });
  });

  it('two alerts that both waited out the outage still count once', async () => {
    const one = bank();
    const other = ewallet();
    capture(one);
    capture(other);
    backendDownFor(BANK_ALERT, TNG_ALERT);
    await run();
    await run();
    expect(queueState(one.id)).toEqual({ status: 'pending', attempts: 1 });
    expect(queueState(other.id)).toEqual({ status: 'pending', attempts: 1 });
    expect(openProposals()).toEqual([]);

    mockModel();
    await run();

    expect(openProposals()).toHaveLength(1);
    expect(openProposals()[0]).toMatchObject({ id: one.id, ...ONE_PAYMENT });
    expect(logEntry(one.id).status).toBe('waiting_for_review');
    expect(logEntry(other.id)).toEqual({
      id: other.id,
      status: 'same_payment',
      pairedProposalId: one.id,
    });
  });

  it('a retried transfer leg joins its other leg as one ledger transfer', async () => {
    const first = tngReload();
    capture(first);
    await run();

    const retried = bankReload();
    capture(retried);
    backendDownFor(BANK_RELOAD);
    await run();
    expect(openProposals().map((row) => row.id)).toEqual([first.id]);

    mockModel();
    await run();

    expect(openProposals()).toEqual([]);
    expect(ledgerRows()).toHaveLength(1);
    const [row] = ledgerRows();
    expect(row).toMatchObject({
      type: 'transfer',
      wallet_id: MAYBANK,
      transfer_to_wallet_id: TNG,
      amount: '100.00',
    });
    expect(logEntry(retried.id)).toEqual({
      id: retried.id,
      status: 'same_payment',
      transactionId: row!.id,
    });
    expect(logEntry(first.id)).toEqual({
      id: first.id,
      status: 'auto_added',
      transactionId: row!.id,
    });
  });

  it('a kill right after the pairing keeps one row and the Same payment status', async () => {
    capture(ewallet());
    await run();
    const retried = bank();
    capture(retried);
    await run();
    expect(logEntry(retried.id).status).toBe('same_payment');

    markProcessing(retried.id);
    const extract = backendDownFor();
    await run();

    expect(extract).not.toHaveBeenCalled();
    expect(queueState(retried.id).status).toBe('done');
    expect(openProposals()).toHaveLength(1);
    expect(logEntry(retried.id).status).toBe('same_payment');
    expect(postReviewNotification).toHaveBeenCalledTimes(1);
  });

  it('a kill right after a paired transfer does not make a second row', async () => {
    capture(tngReload());
    await run();
    const second = bankReload();
    capture(second);
    await run();
    expect(ledgerRows()).toHaveLength(1);

    markProcessing(second.id);
    const extract = backendDownFor();
    await run();

    expect(extract).not.toHaveBeenCalled();
    expect(ledgerRows()).toHaveLength(1);
    expect(openProposals()).toEqual([]);
    expect(logEntry(second.id).status).toBe('same_payment');
  });

  it('a redelivery under a new id, while the first copy retries, still makes one row', async () => {
    const first = bank();
    capture(first);
    backendDownFor(BANK_ALERT);
    await run();
    expect(logEntry(first.id).status).toBe('trying_again');

    const redelivered: NotificationQueueItem = { ...bank(), notification: first.notification };
    capture(redelivered);
    mockModel();
    await run();

    expect(openProposals()).toHaveLength(1);
    expect(openProposals()[0]!.id).toBe(redelivered.id);
    expect(logEntry(redelivered.id).status).toBe('waiting_for_review');
    expect(logEntry(first.id).status).toBe('ignored');
    expect(queueState(first.id).status).toBe('error');
  });
});

describe('capture health while an alert retries', () => {
  it('a retrying alert is neither a capture nor Ignored', async () => {
    const item = bank();
    capture(item);
    backendDownFor(BANK_ALERT);
    await run();

    expect(logEntry(item.id).status).toBe('trying_again');
    expect(lastCaptured(MAYBANK_APP)).toBeNull();
    expect(sourceHealth(readCaptureHealth(), MAYBANK_APP).captureDays).toEqual([]);
  });

  it('counts the capture once extraction succeeds, at the time the alert arrived', async () => {
    const item = bank();
    capture(item);
    backendDownFor(BANK_ALERT);
    await run();

    mockModel();
    await jest.advanceTimersByTimeAsync(3 * HOUR);
    await run();

    expect(logEntry(item.id).status).toBe('waiting_for_review');
    expect(lastCaptured(MAYBANK_APP)).toBe(new Date(T0).toISOString());
  });

  it('a genuine skip counts for nothing and shows Ignored', async () => {
    const item = bank();
    capture(item);
    (getAiClient as jest.Mock).mockReturnValue({
      extractFromNotification: async () => ({ status: 'skipped', reason: 'Not a transaction' }),
    });
    await run();

    expect(logEntry(item.id).status).toBe('ignored');
    expect(lastCaptured(MAYBANK_APP)).toBeNull();
  });

  it('what gave up counts for nothing', async () => {
    const eightDaysOld = new Date(T0 - 8 * 24 * HOUR).toISOString();
    const item: NotificationQueueItem = { ...bank(), createdAt: eightDaysOld };
    capture({ ...item, notification: { ...item.notification, receivedAt: eightDaysOld } });
    backendDownFor(BANK_ALERT);
    await run();

    expect(logEntry(item.id).status).toBe('gave_up');
    expect(queueState(item.id).status).toBe('gave_up');
    expect(lastCaptured(MAYBANK_APP)).toBeNull();
  });

  it('a paired alert counts for its own app, because Moni read it and counted it', async () => {
    const first = ewallet();
    capture(first);
    await run();
    const retried = bank();
    capture(retried);
    backendDownFor(BANK_ALERT);
    await run();
    expect(lastCaptured(MAYBANK_APP)).toBeNull();

    mockModel();
    await run();

    expect(logEntry(retried.id).status).toBe('same_payment');
    expect(lastCaptured(MAYBANK_APP)).toBe(new Date(T0).toISOString());
    expect(lastCaptured(TNG_APP)).toBe(new Date(T0 + MINUTE).toISOString());
  });
});
