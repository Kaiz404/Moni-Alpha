/**
 * Read-only snapshot of notification-related unified-queue work.
 * Notifications share the same background processor as text/image; this
 * isolates counts + "is notification pipeline active" for the debug monitor.
 */
import { getAll, peekPending } from '@/lib/ai/processing-queue';
import { isBackgroundProcessorRunning } from '@/lib/ai/background-processor';

export type NotificationProcessSnapshot = {
  /** True while a notification item is processing or BG is draining the next pending notification. */
  running: boolean;
  pending: number;
  processing: number;
  done: number;
  error: number;
  total: number;
  /** Next FIFO item is a notification and BG is up (about to process it). */
  nextPendingIsNotification: boolean;
};

export function getNotificationProcessSnapshot(): NotificationProcessSnapshot {
  const items = getAll().filter((i) => i.type === 'notification');
  const pending = items.filter((i) => i.status === 'pending').length;
  const processing = items.filter((i) => i.status === 'processing').length;
  const done = items.filter((i) => i.status === 'done').length;
  const error = items.filter((i) => i.status === 'error').length;

  const peek = peekPending();
  const bg = isBackgroundProcessorRunning();
  const nextPendingIsNotification = peek?.type === 'notification';

  const running =
    processing > 0 || (bg && nextPendingIsNotification);

  return {
    running,
    pending,
    processing,
    done,
    error,
    total: items.length,
    nextPendingIsNotification,
  };
}
