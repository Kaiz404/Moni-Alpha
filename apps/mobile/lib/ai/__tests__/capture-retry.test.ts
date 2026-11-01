import type { Observable } from '@legendapp/state';

import type { ExtractResult } from '@/lib/ai/client';
import type { NotificationQueueItem } from '../processing-queue';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-11-01T02:00:00.000Z').getTime();
const ID = '11111111-1111-4111-8111-111111111111';
const PACKAGE = 'com.maybank2u.life';
const ALERT = "MAYBANK: You've spent RM12.00 at KEDAI ABC.";

const UNAVAILABLE: ExtractResult = { status: 'unavailable', reason: 'AI backend error (503)' };
const READ: ExtractResult = {
  status: 'ok',
  extraction: {
    amount: 12,
    type: 'expense',
    currency: 'MYR',
    merchant: 'KEDAI ABC',
    description: 'Lunch',
    walletHint: null,
    categoryHint: null,
    walletId: 'w1',
    transferToWalletHint: null,
    transferToWalletId: null,
    confidence: 0.9,
    reasoning: 'A payment.',
  },
};

const mockExtract = jest.fn<Promise<ExtractResult>, [unknown]>();
const mockStores = new Map<string, Map<string, string>>();
const mockTables: Record<string, Observable<Record<string, Record<string, unknown>>>> = {};
let mockRules: Record<string, unknown>[] = [];
const mockService = { running: false };

jest.mock('react-native-mmkv', () => ({
  createMMKV: ({ id }: { id: string }) => {
    const store = mockStores.get(id) ?? new Map<string, string>();
    mockStores.set(id, store);
    return {
      set: (key: string, value: string) => store.set(key, value),
      getString: (key: string) => store.get(key),
      remove: (key: string) => store.delete(key),
    };
  },
}));
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
jest.mock('@/lib/ai/client', () => ({
  getAiClient: () => ({ extractFromNotification: mockExtract }),
}));
jest.mock('@/lib/store', () => {
  if (!mockTables.proposedTransactions$) {
    const { observable } = jest.requireActual('@legendapp/state');
    mockTables.wallets$ = observable({ w1: { id: 'w1', currency: 'MYR', deleted: false } });
    mockTables.transactions$ = observable({});
    mockTables.proposedTransactions$ = observable({});
    mockTables.autoAddRules$ = observable({});
  }
  return { ...mockTables, assertMigrated: () => {}, isMigrated: () => true };
});
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/supabase/wallets', () => ({
  getWallets: async () => [
    { id: 'w1', name: 'Maybank', currency: 'MYR', notificationPackage: PACKAGE, isActive: true },
  ],
}));
jest.mock('@/lib/supabase/categories', () => ({
  getCategories: async () => [{ id: 'c1', isActive: true }],
}));
jest.mock('@/lib/supabase/auto-add-rules', () => ({ listAutoAddRules: () => mockRules }));
jest.mock('@/lib/wallets/default-wallet', () => ({ getDefaultWalletId: () => 'w1' }));
jest.mock('@/lib/ai/proposal-location-cache', () => ({
  saveProposalLocationSnapshot: jest.fn(),
  getProposalLocationSnapshot: jest.fn(),
  clearProposalLocationSnapshot: jest.fn(),
}));
jest.mock('@/lib/notifications/review-notification', () => ({
  postReviewNotification: jest.fn(async () => {}),
}));

type Queue = typeof import('../processing-queue');
type Processor = typeof import('../background-processor');

/** What a process knows when it starts: only MMKV and the store survive, as after a kill. */
function launch(): { queue: Queue; processor: Processor } {
  jest.resetModules();
  mockService.running = false;
  return {
    queue: require('../processing-queue'),
    processor: require('../background-processor'),
  };
}

function alert(over: Partial<NotificationQueueItem> = {}): NotificationQueueItem {
  const createdAt = over.createdAt ?? new Date(NOW).toISOString();
  return {
    id: ID,
    type: 'notification',
    status: 'pending',
    createdAt,
    notification: {
      id: over.id ?? ID,
      app: 'Maybank',
      packageName: PACKAGE,
      title: 'Maybank',
      text: ALERT,
      time: '1',
      receivedAt: createdAt,
    },
    ...over,
  };
}

/** Writes the capture log entry the headless task writes at intake. */
function logged(item: NotificationQueueItem) {
  const notifications = mockStores.get('moni-notifications') ?? new Map<string, string>();
  mockStores.set('moni-notifications', notifications);
  const list = JSON.parse(notifications.get('captured_notifications') ?? '[]');
  list.unshift({ ...item.notification, id: item.id, status: 'waiting_for_review' });
  notifications.set('captured_notifications', JSON.stringify(list));
}

function logStatus(id = ID): string | undefined {
  const list = JSON.parse(
    mockStores.get('moni-notifications')?.get('captured_notifications') ?? '[]',
  ) as { id: string; status: string }[];
  return list.find((entry) => entry.id === id)?.status;
}

const queueState = (queue: Queue, id = ID) => {
  const item = queue.getAll().find((entry) => entry.id === id);
  return item && { status: item.status, attempts: item.attempts ?? 0 };
};

const liveRows = (table: string) =>
  Object.values(mockTables[table]!.peek() ?? {}).filter((row) => row && !row.deleted);

/** The processor waits 500ms before it starts, and 200ms between items. */
const settle = () => jest.advanceTimersByTimeAsync(1_000);

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mockExtract.mockReset();
  mockStores.clear();
  mockRules = [];
  mockTables.transactions$?.set({});
  mockTables.proposedTransactions$?.set({});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('a capture while the backend is down', () => {
  it('stays queued, shows Trying again, and becomes exactly one proposal when the backend returns', async () => {
    const { queue, processor } = launch();
    const item = alert();
    logged(item);
    queue.enqueue(item);
    mockExtract.mockResolvedValueOnce(UNAVAILABLE).mockResolvedValue(READ);

    await processor.startBackgroundProcessor();
    await settle();
    expect(mockExtract).toHaveBeenCalledTimes(1);
    expect(queueState(queue)).toEqual({ status: 'pending', attempts: 1 });
    expect(logStatus()).toBe('trying_again');
    expect(liveRows('proposedTransactions$')).toEqual([]);

    await jest.advanceTimersByTimeAsync(20_000);
    expect(mockExtract).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(11_000);
    await settle();
    expect(mockExtract).toHaveBeenCalledTimes(2);
    expect(queueState(queue)).toEqual({ status: 'done', attempts: 1 });
    expect(logStatus()).toBe('waiting_for_review');
    expect(liveRows('proposedTransactions$').map((row) => row.id)).toEqual([ID]);

    await jest.advanceTimersByTimeAsync(2 * HOUR);
    expect(mockExtract).toHaveBeenCalledTimes(2);
    expect(liveRows('proposedTransactions$')).toHaveLength(1);
  });

  it('tries one item per run, because an outage is shared', async () => {
    const { queue, processor } = launch();
    queue.enqueue(alert({ id: 'a' }));
    queue.enqueue(alert({ id: 'b' }));
    queue.enqueue(alert({ id: 'c' }));
    mockExtract.mockResolvedValue(UNAVAILABLE);

    await processor.startBackgroundProcessor();
    await settle();
    expect(mockExtract).toHaveBeenCalledTimes(1);
    expect(queue.getAll().map((item) => [item.id, item.status, item.attempts ?? 0])).toEqual([
      ['a', 'pending', 1],
      ['b', 'pending', 0],
      ['c', 'pending', 0],
    ]);
  });

  it('doubles the wait from 30s up to 1h, and starts over once the backend answers', () => {
    const { queue } = launch();
    queue.enqueue(alert());
    const waits = Array.from({ length: 9 }, () => queue.markRetry(ID, NOW).retryInMs);
    expect(waits).toEqual([
      30_000, 60_000, 120_000, 240_000, 480_000, 960_000, 1_920_000, 3_600_000, 3_600_000,
    ]);
    queue.markDone(ID);
    expect(queue.markRetry(ID, NOW).retryInMs).toBe(30_000);
  });

  it('retries on the next capture without waiting out the backoff', async () => {
    const { queue, processor } = launch();
    queue.enqueue(alert({ id: 'first' }));
    mockExtract.mockResolvedValueOnce(UNAVAILABLE).mockResolvedValue(READ);
    await processor.startBackgroundProcessor();
    await settle();

    queue.enqueue(alert({ id: 'second' }));
    await processor.startBackgroundProcessor();
    await settle();
    expect(queueState(queue, 'second')).toEqual({ status: 'done', attempts: 0 });
    expect(queueState(queue, 'first')).toEqual({ status: 'done', attempts: 1 });
  });

  it('never lets an item that always fails hold back a fresh one', () => {
    const { queue } = launch();
    queue.enqueue(alert({ id: 'stuck', attempts: 3, createdAt: new Date(NOW - HOUR).toISOString() }));
    queue.enqueue(alert({ id: 'fresh' }));
    expect(queue.peekPending()?.id).toBe('fresh');
  });

  it('processes with the app in the foreground when Android refuses the service', async () => {
    const { queue, processor } = launch();
    const service = jest.requireMock('react-native-background-actions').default;
    jest.spyOn(service, 'start').mockRejectedValueOnce(new Error('not allowed from background'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    queue.enqueue(alert());
    mockExtract.mockResolvedValue(READ);

    const started = processor.startBackgroundProcessor();
    await settle();
    await started;
    expect(queueState(queue)).toEqual({ status: 'done', attempts: 0 });
    expect(processor.isBackgroundProcessorRunning()).toBe(false);
  });
});

describe('a chat receipt waiting on the reader', () => {
  it('stops waiting as soon as the first try fails, and stays queued', async () => {
    const { queue, processor } = launch();
    const { waitForProposal } = require('@/lib/proposals/proposal-wait');
    queue.enqueue(alert());
    mockExtract.mockResolvedValue(UNAVAILABLE);
    const waited = waitForProposal(ID);

    await processor.startBackgroundProcessor();
    await settle();
    await expect(waited).resolves.toBe('retrying');
    expect(queueState(queue)).toEqual({ status: 'pending', attempts: 1 });
  });
});

describe('a capture across a kill', () => {
  it('resumes a failed item after a restart and creates one proposal', async () => {
    const first = launch();
    const item = alert();
    logged(item);
    first.queue.enqueue(item);
    mockExtract.mockResolvedValueOnce(UNAVAILABLE);
    await first.processor.startBackgroundProcessor();
    await settle();
    expect(queueState(first.queue)).toEqual({ status: 'pending', attempts: 1 });

    const second = launch();
    expect(queueState(second.queue)).toEqual({ status: 'pending', attempts: 1 });
    mockExtract.mockResolvedValue(READ);
    await second.processor.startBackgroundProcessor();
    await settle();
    expect(queueState(second.queue)).toEqual({ status: 'done', attempts: 1 });
    expect(logStatus()).toBe('waiting_for_review');
    expect(liveRows('proposedTransactions$').map((row) => row.id)).toEqual([ID]);
  });

  it('resumes an item killed mid-request, which had stayed processing', async () => {
    const first = launch();
    first.queue.enqueue(alert());
    mockExtract.mockReturnValueOnce(new Promise(() => {}));
    await first.processor.startBackgroundProcessor();
    await settle();
    expect(queueState(first.queue)).toEqual({ status: 'processing', attempts: 0 });

    const second = launch();
    mockExtract.mockResolvedValue(READ);
    await second.processor.startBackgroundProcessor();
    await settle();
    expect(queueState(second.queue)).toEqual({ status: 'done', attempts: 0 });
    expect(liveRows('proposedTransactions$')).toHaveLength(1);
  });

  it('does not write a second proposal when the kill came after the first was written', async () => {
    const first = launch();
    const item = alert();
    logged(item);
    first.queue.enqueue(item);
    mockExtract.mockResolvedValue(READ);
    await first.processor.startBackgroundProcessor();
    await settle();
    expect(liveRows('proposedTransactions$')).toHaveLength(1);
    mockExtract.mockClear();

    first.queue.markProcessing(ID);
    const second = launch();
    await second.processor.startBackgroundProcessor();
    await settle();
    expect(mockExtract).not.toHaveBeenCalled();
    expect(queueState(second.queue)).toEqual({ status: 'done', attempts: 0 });
    expect(liveRows('proposedTransactions$')).toHaveLength(1);
  });

  it('does not write a second transaction for a routine alert', async () => {
    mockRules = [
      { merchantKey: 'kedai abc', sourceApp: PACKAGE, walletId: 'w1', categoryId: 'c1' },
    ];
    const first = launch();
    const item = alert();
    logged(item);
    first.queue.enqueue(item);
    mockExtract.mockResolvedValue(READ);
    await first.processor.startBackgroundProcessor();
    await settle();
    expect(liveRows('transactions$').map((row) => row.id)).toEqual([ID]);
    expect(logStatus()).toBe('auto_added');
    mockExtract.mockClear();

    first.queue.markProcessing(ID);
    const second = launch();
    await second.processor.startBackgroundProcessor();
    await settle();
    expect(mockExtract).not.toHaveBeenCalled();
    expect(queueState(second.queue)).toEqual({ status: 'done', attempts: 0 });
    expect(liveRows('transactions$').map((row) => row.id)).toEqual([ID]);
    expect(logStatus()).toBe('auto_added');
  });
});

describe('a genuine skip', () => {
  it('stays terminal, shows Ignored, and is never retried', async () => {
    const { queue, processor } = launch();
    const item = alert();
    logged(item);
    queue.enqueue(item);
    mockExtract.mockResolvedValue({ status: 'skipped', reason: 'Not a transaction' });

    await processor.startBackgroundProcessor();
    await settle();
    await jest.advanceTimersByTimeAsync(2 * HOUR);
    await processor.startBackgroundProcessor();
    await settle();
    expect(mockExtract).toHaveBeenCalledTimes(1);
    expect(queueState(queue)).toEqual({ status: 'error', attempts: 0 });
    expect(logStatus()).toBe('ignored');
    expect(liveRows('proposedTransactions$')).toEqual([]);
  });

  it('stays terminal for a one-time code, which never reaches the backend', async () => {
    const { queue, processor } = launch();
    const base = alert();
    const item = { ...base, notification: { ...base.notification, text: 'Your TAC is 482910' } };
    logged(item);
    queue.enqueue(item);

    await processor.startBackgroundProcessor();
    await settle();
    expect(mockExtract).not.toHaveBeenCalled();
    expect(queueState(queue)).toEqual({ status: 'error', attempts: 0 });
    expect(logStatus()).toBe('ignored');
  });
});

describe('giving up', () => {
  const eightDaysOld = () => alert({ createdAt: new Date(NOW - 8 * DAY).toISOString() });

  it('still tries an old capture once, in case the backend is back', async () => {
    const { queue, processor } = launch();
    queue.enqueue(eightDaysOld());
    mockExtract.mockResolvedValue(READ);
    await processor.startBackgroundProcessor();
    await settle();
    expect(queueState(queue)).toEqual({ status: 'done', attempts: 0 });
  });

  it('shows the status, counts it for Capture sources, stops retrying, and Retry brings it back', async () => {
    const { queue, processor } = launch();
    const { groupCaptureLog } = require('@/lib/notifications/capture-log');
    const { unreachedCounts, unreachedLine } = require('@/lib/notifications/capture-health');
    const item = eightDaysOld();
    logged(item);
    queue.enqueue(item);
    mockExtract.mockResolvedValueOnce(UNAVAILABLE).mockResolvedValue(READ);

    await processor.startBackgroundProcessor();
    await settle();
    expect(queueState(queue)).toEqual({ status: 'gave_up', attempts: 1 });
    expect(logStatus()).toBe('gave_up');
    const stored = JSON.parse(
      mockStores.get('moni-notifications')!.get('captured_notifications')!,
    );
    expect(groupCaptureLog(stored, new Date(NOW))[0].items[0].label).toBe("Couldn't reach Moni");

    const counts = unreachedCounts(queue.listGaveUp());
    expect(counts).toEqual({ total: 1, byPackage: { [PACKAGE]: 1 } });
    expect(unreachedLine(counts, PACKAGE)).toBe("1 couldn't reach Moni");
    expect(unreachedLine(counts, 'com.grab.driver')).toBeNull();

    await jest.advanceTimersByTimeAsync(2 * HOUR);
    expect(mockExtract).toHaveBeenCalledTimes(1);

    await processor.retryCaptures(ID);
    expect(logStatus()).toBe('trying_again');
    await settle();
    expect(mockExtract).toHaveBeenCalledTimes(2);
    expect(queueState(queue)).toEqual({ status: 'done', attempts: 0 });
    expect(logStatus()).toBe('waiting_for_review');
    expect(liveRows('proposedTransactions$')).toHaveLength(1);
    expect(unreachedCounts(queue.listGaveUp())).toEqual({ total: 0, byPackage: {} });
  });

  it('gives up on every stale capture at once, not one per try', () => {
    const { queue } = launch();
    const stale = new Date(NOW - 8 * DAY).toISOString();
    queue.enqueue(alert({ id: 'tried', createdAt: stale }));
    queue.enqueue(alert({ id: 'waiting', createdAt: stale }));
    queue.enqueue(alert({ id: 'recent' }));
    queue.markRetry('tried', NOW);
    expect(queue.getAll().map((item) => [item.id, item.status])).toEqual([
      ['tried', 'gave_up'],
      ['waiting', 'gave_up'],
      ['recent', 'pending'],
    ]);
  });
});

describe('the queue size', () => {
  it('holds 200 live items, dropping finished work first and an unread capture last', () => {
    const { queue } = launch();
    const at = (index: number) => new Date(NOW + index * 1_000).toISOString();
    queue.enqueue(alert({ id: 'gave-up', status: 'gave_up', createdAt: at(-2) }));
    const oldest = alert({ id: 'oldest', createdAt: at(-1) });
    logged(oldest);
    queue.enqueue(oldest);
    for (let index = 0; index < 25; index++) {
      queue.enqueue(alert({ id: `done-${index}`, status: 'done', createdAt: at(index) }));
    }
    expect(queue.getAll()).toHaveLength(22);
    expect(queueState(queue, 'done-0')).toBeUndefined();
    expect(queueState(queue, 'done-5')).toEqual({ status: 'done', attempts: 0 });

    for (let index = 0; index < 198; index++) {
      queue.enqueue(alert({ id: `live-${index}`, createdAt: at(index) }));
    }
    expect(queue.getPendingCount()).toBe(199);
    expect(queueState(queue, 'gave-up')).toEqual({ status: 'gave_up', attempts: 0 });

    queue.enqueue(alert({ id: 'one-over', createdAt: at(500) }));
    expect(queueState(queue, 'gave-up')).toBeUndefined();
    expect(queueState(queue, 'oldest')).toEqual({ status: 'pending', attempts: 0 });

    queue.enqueue(alert({ id: 'two-over', createdAt: at(501) }));
    expect(queueState(queue, 'oldest')).toBeUndefined();
    expect(logStatus('oldest')).toBe('gave_up');
  });
});

describe('a capture held on the failed page', () => {
  it('is left alone until the page lets go of it', async () => {
    const { queue, processor } = launch();
    queue.enqueue(alert({ id: 'on-screen' }));
    queue.enqueue(alert({ id: 'held', status: 'held' }));
    mockExtract.mockResolvedValue(READ);
    await processor.startBackgroundProcessor();
    await settle();
    queue.enqueue(alert({ id: 'held-next', status: 'held' }));
    await processor.startBackgroundProcessor();
    await settle();
    expect(queueState(queue, 'held-next')).toEqual({ status: 'held', attempts: 0 });

    queue.releaseHeld('held-next');
    await processor.startBackgroundProcessor();
    await settle();
    expect(queueState(queue, 'held-next')).toEqual({ status: 'done', attempts: 0 });
  });

  it('comes back after a kill on the failed page', async () => {
    const first = launch();
    first.queue.enqueue(alert({ status: 'held' }));

    const second = launch();
    mockExtract.mockResolvedValue(READ);
    await second.processor.startBackgroundProcessor();
    await settle();
    expect(queueState(second.queue)).toEqual({ status: 'done', attempts: 0 });
    expect(liveRows('proposedTransactions$')).toHaveLength(1);
  });
});

describe('signing out', () => {
  it('leaves nothing for the next account on this phone', () => {
    const { queue } = launch();
    queue.enqueue(alert());
    queue.markRetry(ID, NOW);
    queue.pruneCompleted();
    expect(queue.getAll()).toEqual([]);
    expect(queue.markRetry(ID, NOW).retryInMs).toBe(30_000);
  });
});
