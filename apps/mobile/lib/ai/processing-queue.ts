import { createMMKV } from 'react-native-mmkv';
import type { RawNotification } from './notification-types';
import type { LocationSnapshot } from '@/lib/location/location-snapshot';
import { markCaptureStatus } from '@/lib/notifications/capture-status';

const storage = createMMKV({ id: 'moni-processing' });
const QUEUE_KEY = 'unified_processing_queue';
const FAILURES_KEY = 'unified_processing_failures';

/** The wait after the first failure in a row. It doubles up to the cap: 30s, 1m, 2m ... 1h. */
const RETRY_BASE_MS = 30_000;
const RETRY_CAP_MS = 60 * 60_000;
/** A week covers a paused Supabase project or a phone left offline over a holiday. */
const GIVE_UP_AFTER_MS = 7 * 24 * 60 * 60_000;
/** A week of about 30 alerts a day. They hold text only, because intake strips the icons. */
const MAX_LIVE_ITEMS = 200;
const MAX_FINISHED_ITEMS = 20;

// ─── Queue item types ────────────────────────────────────────────────────────

type QueueItemBase = {
  id: string;
  createdAt: string;
  /**
   * `pending` waits for the processor; a retry goes back here. `error` is a genuine skip.
   * `held` is on Say it or Scan's failed page, which is still deciding, so the processor leaves it.
   * `gave_up` could not reach the backend for `GIVE_UP_AFTER_MS` and waits for the user's Retry.
   */
  status: 'pending' | 'processing' | 'done' | 'error' | 'held' | 'gave_up';
  /** Failed attempts. Fewest go first, so one item that always fails cannot block the rest. */
  attempts?: number;
  locationSnapshot?: LocationSnapshot | null;
};

export type TextQueueItem = QueueItemBase & {
  type: 'text';
  text: string;
};

export type ImageQueueItem = QueueItemBase & {
  type: 'image';
  imageUri: string;
  userContext?: string;
};

export type NotificationQueueItem = QueueItemBase & {
  type: 'notification';
  notification: RawNotification;
};

export type ProcessingQueueItem = TextQueueItem | ImageQueueItem | NotificationQueueItem;

// ─── Queue operations ────────────────────────────────────────────────────────

function readQueue(): ProcessingQueueItem[] {
  try {
    const raw = storage.getString(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: ProcessingQueueItem[]) {
  storage.set(QUEUE_KEY, JSON.stringify(items));
}

function setStatus(id: string, status: ProcessingQueueItem['status']) {
  const queue = readQueue();
  const item = queue.find((i) => i.id === id);
  if (item) item.status = status;
  writeQueue(queue);
}

function markAlert(item: ProcessingQueueItem, status: 'trying_again' | 'gave_up') {
  if (item.type === 'notification') markCaptureStatus(item.id, status);
}

const oldestFirst = (a: ProcessingQueueItem, b: ProcessingQueueItem) =>
  a.createdAt.localeCompare(b.createdAt);

function isFinished(item: ProcessingQueueItem) {
  return item.status === 'done' || item.status === 'error';
}

/** Finished items go first, then what already gave up, and an unread capture only as a last resort. */
function evict(queue: ProcessingQueueItem[]): ProcessingQueueItem[] {
  const finished = queue.filter(isFinished).sort(oldestFirst);
  const live = queue.filter((item) => !isFinished(item));
  const dropped = new Set(finished.slice(0, Math.max(0, finished.length - MAX_FINISHED_ITEMS)));
  const overflow = live.length - MAX_LIVE_ITEMS;
  if (overflow > 0) {
    const byStatus = (status: ProcessingQueueItem['status']) =>
      live.filter((item) => item.status === status).sort(oldestFirst);
    for (const item of [...byStatus('gave_up'), ...byStatus('pending')].slice(0, overflow)) {
      dropped.add(item);
      markAlert(item, 'gave_up');
    }
  }
  return queue.filter((item) => !dropped.has(item));
}

export function enqueue(item: ProcessingQueueItem) {
  writeQueue(evict([...readQueue(), item]));
}

/** The next pending item, without removing it: fewest failed attempts, then oldest. */
export function peekPending(): ProcessingQueueItem | null {
  const pending = readQueue().filter((i) => i.status === 'pending');
  pending.sort((a, b) => (a.attempts ?? 0) - (b.attempts ?? 0) || oldestFirst(a, b));
  return pending[0] ?? null;
}

/** Mark an item as processing. */
export function markProcessing(id: string) {
  setStatus(id, 'processing');
}

/** Mark an item as done (keep in history). The backend answered, so the backoff starts over. */
export function markDone(id: string) {
  storage.remove(FAILURES_KEY);
  setStatus(id, 'done');
}

/** A genuine skip, which is terminal. The backend answered, so the backoff starts over. */
export function markError(id: string) {
  storage.remove(FAILURES_KEY);
  setStatus(id, 'error');
}

/**
 * The backend could not be reached for this item. It goes back to pending, anything past
 * `GIVE_UP_AFTER_MS` gives up, and the answer says how long to wait before trying the queue again.
 * The wait belongs to the queue: an outage is shared, so one failed request is enough to know.
 */
export function markRetry(id: string, now = Date.now()): { retryInMs: number } {
  const failures = (Number(storage.getString(FAILURES_KEY)) || 0) + 1;
  storage.set(FAILURES_KEY, String(failures));
  const queue = readQueue();
  for (const item of queue) {
    if (item.id === id) {
      item.status = 'pending';
      item.attempts = (item.attempts ?? 0) + 1;
      markAlert(item, 'trying_again');
    }
    if (item.status === 'pending' && now - Date.parse(item.createdAt) >= GIVE_UP_AFTER_MS) {
      item.status = 'gave_up';
      markAlert(item, 'gave_up');
    }
  }
  writeQueue(queue);
  return { retryInMs: Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_CAP_MS) };
}

/**
 * Puts back what a killed process left mid-flight. Call only when no processor is running. A held
 * item comes back only for the first run in a process, because before that no page can be open.
 */
export function resumeInterrupted({ includeHeld }: { includeHeld: boolean }) {
  const queue = readQueue();
  for (const item of queue) {
    if (item.status === 'processing' || (includeHeld && item.status === 'held')) {
      item.status = 'pending';
    }
  }
  writeQueue(queue);
}

/** The failed page is done deciding: Moni keeps trying and the capture lands in Review. */
export function releaseHeld(id: string) {
  setStatus(id, 'pending');
}

/** The user's Retry: one gave-up item, or all of them. Its age no longer stops the next attempt. */
export function requeueGaveUp(id?: string) {
  const queue = readQueue();
  for (const item of queue) {
    if (item.status === 'gave_up' && (id === undefined || item.id === id)) {
      item.status = 'pending';
      item.attempts = 0;
      markAlert(item, 'trying_again');
    }
  }
  writeQueue(queue);
}

export function listGaveUp(): ProcessingQueueItem[] {
  return readQueue().filter((i) => i.status === 'gave_up');
}

/** Removing an alert from the Capture log takes the kept copy with it. Returned for Undo. */
export function discardGaveUpAlerts(id?: string): ProcessingQueueItem[] {
  const queue = readQueue();
  const removed = queue.filter(
    (item) =>
      item.status === 'gave_up' &&
      item.type === 'notification' &&
      (id === undefined || item.id === id),
  );
  writeQueue(queue.filter((item) => !removed.includes(item)));
  return removed;
}

export function restoreItems(items: readonly ProcessingQueueItem[]) {
  const queue = readQueue();
  const present = new Set(queue.map((item) => item.id));
  writeQueue([...queue, ...items.filter((item) => !present.has(item.id))]);
}

export function remove(id: string) {
  writeQueue(readQueue().filter((i) => i.id !== id));
}

export function getAll(): ProcessingQueueItem[] {
  return readQueue();
}

export function getPendingCount(): number {
  return readQueue().filter((i) => i.status === 'pending').length;
}

/** Clear the entire queue, regardless of status. */
export function pruneCompleted() {
  writeQueue([]);
  storage.remove(FAILURES_KEY);
}
