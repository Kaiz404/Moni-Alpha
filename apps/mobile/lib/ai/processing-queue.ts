import { createMMKV } from 'react-native-mmkv';
import type { RawNotification } from './notification-types';
import type { LocationSnapshot } from '@/lib/location/location-snapshot';

const storage = createMMKV({ id: 'moni-processing' });
const QUEUE_KEY = 'unified_processing_queue';

// ─── Queue item types ────────────────────────────────────────────────────────

type QueueItemBase = {
  id: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'done' | 'error';
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

export type ProcessingQueueItem =
  | TextQueueItem
  | ImageQueueItem
  | NotificationQueueItem;

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

export function enqueue(item: ProcessingQueueItem) {
  const queue = readQueue();
  queue.push(item);
  writeQueue(queue);
}

/** Return the next pending item without removing it. */
export function peekPending(): ProcessingQueueItem | null {
  return readQueue().find((i) => i.status === 'pending') ?? null;
}

/** Mark an item as processing. */
export function markProcessing(id: string) {
  const queue = readQueue();
  const item = queue.find((i) => i.id === id);
  if (item) item.status = 'processing';
  writeQueue(queue);
}

/** Mark an item as done (keep in history). */
export function markDone(id: string) {
  const queue = readQueue();
  const item = queue.find((i) => i.id === id);
  if (item) item.status = 'done';
  writeQueue(queue);
}

/** Mark an item as errored. */
export function markError(id: string) {
  const queue = readQueue();
  const item = queue.find((i) => i.id === id);
  if (item) item.status = 'error';
  writeQueue(queue);
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
}
