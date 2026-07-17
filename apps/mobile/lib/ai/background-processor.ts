/**
 * Background processor that drains the unified processing queue using an
 * Android foreground service (via react-native-background-actions).
 *
 * Inference is delegated to the AI backend client (mock until Go service exists).
 */
import BackgroundService from 'react-native-background-actions';
import {
  peekPending,
  markProcessing,
  markDone,
  markError,
  getPendingCount,
} from './processing-queue';
import { runExtraction } from './run-extraction';

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

const BACKGROUND_OPTIONS = {
  taskName: 'MoniTransactionProcessor',
  taskTitle: 'Processing transactions',
  taskDesc: 'Moni is analyzing your input in the background...',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#4F46E5',
  linkingURI: 'moni://',
  parameters: {
    delay: 500,
  },
};

async function processingTask(taskData?: { delay?: number }) {
  const delay = taskData?.delay ?? 500;
  await new Promise((r) => setTimeout(r, delay));

  console.log(TAG, '\u{250C}\u{2500}\u{2500} Background task started');

  try {
    const isServiceAlive = BackgroundService.isRunning();
    console.log(TAG, `\u{2502}  Service alive: ${isServiceAlive}`);

    let processedCount = 0;
    const queueStart = Date.now();

    while (BackgroundService.isRunning()) {
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

        if (result.created) {
          console.log(
            TAG,
            `\u{2502}  \u{2705} Created proposal (${elapsed}ms)${result.proposalId ? ` id=${result.proposalId}` : ''}`,
          );
          processedCount++;
          markDone(item.id);
        } else {
          console.log(TAG, `\u{2502}  \u{23ED} Skipped (${elapsed}ms): ${result.reason}`);
          // Unavailable / skipped — mark error so the UI can show failure, not hang as processing.
          markError(item.id);
        }
      } catch (e) {
        const elapsed = Date.now() - itemStart;
        console.error(TAG, `\u{2502}  \u{274C} Error (${elapsed}ms):`, e);
        markError(item.id);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    if (processedCount > 0) {
      console.log(TAG, `Total: ${processedCount} proposals created`);
    }
  } finally {
    isRunning = false;
    try {
      if (BackgroundService.isRunning()) {
        await BackgroundService.stop();
      }
    } catch {
      // Ignore stop errors
    }
  }
}

/**
 * Start the background processor if not already running and there are pending items.
 * Safe to call multiple times — will no-op if already active.
 */
export async function startBackgroundProcessor(): Promise<void> {
  if (isRunning) {
    console.log(TAG, 'Already running, skipping start');
    return;
  }

  const pending = getPendingCount();
  if (pending === 0) {
    console.log(TAG, 'No pending items, skipping start');
    return;
  }

  console.log(TAG, `Starting with ${pending} pending items`);
  isRunning = true;

  try {
    await BackgroundService.start(processingTask, BACKGROUND_OPTIONS);
    console.log(TAG, 'Background service started');
  } catch (e) {
    console.error(TAG, 'Failed to start background service:', e);
    isRunning = false;
    console.log(TAG, 'Falling back to foreground processing');
    await processingTask(BACKGROUND_OPTIONS.parameters);
  }
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
