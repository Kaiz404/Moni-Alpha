/**
 * Background processor that drains the unified processing queue using an
 * Android foreground service (via react-native-background-actions).
 *
 * Inference is delegated to the AI backend client (mock until Go service exists).
 */
import { resolveScheme } from 'expo-linking';
import BackgroundService from 'react-native-background-actions';
import {
  peekPending,
  markProcessing,
  markDone,
  markError,
  markRetry,
  getPendingCount,
  requeueGaveUp,
  resumeInterrupted,
  type ProcessingQueueItem,
} from './processing-queue';
import { runExtraction, type RunExtractionResult } from './run-extraction';
import { recordCapture } from '@/lib/notifications/capture-health';
import {
  captureStatusAfterExtraction,
  markCaptureStatus,
} from '@/lib/notifications/capture-status';
import { postReviewNotification } from '@/lib/notifications/review-notification';

const TAG = '[BGProc]';
const NOTIF_TAG = '[NotifProc]';

const STAGE_ICONS: Record<string, string> = {
  extraction: '\u{1F3AF}',
  extractor: '\u{1F4E4}',
  creator: '\u{2705}',
};

function formatTraceEvent(event: {
  stage: string;
  event: string;
  details?: Record<string, unknown>;
}): string {
  const icon = STAGE_ICONS[event.stage] ?? '\u{25CF}';
  const detailStr = event.details
    ? ' ' +
      Object.entries(event.details)
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(' ')
    : '';
  return `  ${icon} [${event.stage}] ${event.event}${detailStr}`;
}

let isRunning = false;
let heldResumed = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const BACKGROUND_OPTIONS = {
  taskName: 'MoniTransactionProcessor',
  taskTitle: 'Processing transactions',
  taskDesc: 'Moni is analyzing your input in the background...',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#236B47',
  parameters: {
    delay: 500,
  },
};

/** Records what became of an attempt. Returns the wait before the next run, if it has to retry. */
async function settle(item: ProcessingQueueItem, result: RunExtractionResult): Promise<number | null> {
  if (!result.created && !result.skipped) return markRetry(item.id).retryInMs;

  if (result.created) markDone(item.id);
  else markError(item.id);
  if (item.type === 'notification') {
    // A paired alert already has its status: pairCapture wrote it.
    if (!result.paired) {
      markCaptureStatus(item.id, captureStatusAfterExtraction(result), result.transactionId);
    }
    if (result.created) {
      recordCapture(item.notification.packageName, item.notification.receivedAt);
    }
    if (result.proposalId && !result.transactionId) {
      await postReviewNotification(result.proposalId).catch((e) => {
        console.error(TAG, 'Review notification not posted:', e);
      });
    }
  }
  return null;
}

async function processingTask(taskData?: { delay?: number; foreground?: boolean }) {
  const delay = taskData?.delay ?? 500;
  await new Promise((r) => setTimeout(r, delay));

  console.log(TAG, '\u{250C}\u{2500}\u{2500} Background task started');

  let retryInMs: number | null = null;
  try {
    let processedCount = 0;
    const queueStart = Date.now();

    while (taskData?.foreground || BackgroundService.isRunning()) {
      const item = peekPending();
      if (!item) {
        console.log(TAG, `\u{2502}`);
        console.log(
          TAG,
          `\u{2514}\u{2500}\u{2500} Queue empty. ${processedCount} items processed in ${Date.now() - queueStart}ms`,
        );
        break;
      }

      markProcessing(item.id);

      const preview =
        item.type === 'text'
          ? `"${item.text.slice(0, 40)}"`
          : item.type === 'notification'
            ? `[${item.notification.app}] "${item.notification.text.slice(0, 35)}"`
            : `image:${item.imageUri.slice(-25)}`;

      if (item.type === 'notification') {
        console.log(
          NOTIF_TAG,
          `Processing notification queue item id=${item.id} app=${item.notification.app}`,
        );
      }

      console.log(TAG, '\u{2502}');
      console.log(
        TAG,
        `\u{251C}\u{2500}\u{2500} Item #${processedCount + 1}: ${item.type} ${preview}`,
      );
      console.log(TAG, `\u{2502}  id: ${item.id}`);

      const itemStart = Date.now();

      try {
        const result = await runExtraction(item, {
          trace: (event) => {
            console.log(TAG, formatTraceEvent(event));
          },
        });
        const elapsed = Date.now() - itemStart;
        retryInMs = await settle(item, result);

        if (result.created) {
          console.log(
            TAG,
            `\u{2502}  \u{2705} ${result.reason} (${elapsed}ms) id=${result.transactionId ?? result.proposalId ?? '?'}`,
          );
          processedCount++;
        } else {
          console.log(TAG, `\u{2502}  \u{23ED} Not added (${elapsed}ms): ${result.reason}`);
        }
      } catch (e) {
        console.error(TAG, `\u{2502}  \u{274C} Error (${Date.now() - itemStart}ms):`, e);
        retryInMs = markRetry(item.id).retryInMs;
      }

      // The backend is out. Everything else would only fail the same way.
      if (retryInMs !== null) break;

      await new Promise((r) => setTimeout(r, 200));
    }

    if (processedCount > 0) {
      console.log(TAG, `Total: ${processedCount} proposals created`);
    }
  } finally {
    isRunning = false;
    if (retryInMs !== null) scheduleRetry(retryInMs);
    try {
      if (BackgroundService.isRunning()) {
        await BackgroundService.stop();
      }
    } catch {
      // Ignore stop errors
    }
  }
}

function clearRetryTimer() {
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
}

/** Only while this process lives. App open, connectivity and the next capture cover the rest. */
function scheduleRetry(ms: number) {
  clearRetryTimer();
  console.log(TAG, `Backend unreachable, next try in ${ms}ms`);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    startBackgroundProcessor().catch((e) => console.error(TAG, 'Retry failed to start:', e));
  }, ms);
}

/**
 * Start the background processor if not already running and there are pending items. It tries
 * right away, whatever the backoff says: every caller is a moment worth one more try (the app
 * opened, connectivity returned, a new capture, the backoff elapsed).
 * Safe to call multiple times — will no-op if already active.
 */
export async function startBackgroundProcessor(): Promise<void> {
  if (isRunning) {
    console.log(TAG, 'Already running, skipping start');
    return;
  }

  resumeInterrupted({ includeHeld: !heldResumed });
  heldResumed = true;

  const pending = getPendingCount();
  if (pending === 0) {
    console.log(TAG, 'No pending items, skipping start');
    return;
  }

  console.log(TAG, `Starting with ${pending} pending items`);
  isRunning = true;
  clearRetryTimer();

  try {
    await BackgroundService.start(processingTask, {
      ...BACKGROUND_OPTIONS,
      linkingURI: `${resolveScheme({})}://`,
    });
    console.log(TAG, 'Background service started');
  } catch (e) {
    console.error(TAG, 'Failed to start background service:', e);
    console.log(TAG, 'Falling back to foreground processing');
    await processingTask({ ...BACKGROUND_OPTIONS.parameters, foreground: true });
  }
}

/** The Retry control: one capture, or everything that gave up. */
export async function retryCaptures(id?: string): Promise<void> {
  requeueGaveUp(id);
  await startBackgroundProcessor();
}

export async function stopBackgroundProcessor(): Promise<void> {
  if (!isRunning) return;
  isRunning = false;
  try {
    await BackgroundService.stop();
  } catch {
    // Ignore
  }
}

export function isBackgroundProcessorRunning(): boolean {
  return isRunning;
}
