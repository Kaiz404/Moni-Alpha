/**
 * Background processor that drains the unified processing queue using an
 * Android foreground service (via react-native-background-actions).
 *
 * This keeps the app process alive while the LLM runs inference, even if the
 * user navigates away or locks the screen.
 */
import BackgroundService from 'react-native-background-actions';
import { getOrLoadModel } from './model-manager';
import {
  peekPending,
  markProcessing,
  markDone,
  markError,
  getPendingCount,
} from './processing-queue';
import { runOrchestration } from './orchestrator/index';

const TAG = '[BGProc]';
const NOTIF_TAG = '[NotifProc]';

// Visual icons for sub-agent stages in console output
const STAGE_ICONS: Record<string, string> = {
  orchestrator: '\u{1F3AF}', // dart
  classifier:   '\u{1F50D}', // magnifier
  extractor:    '\u{1F4E4}', // outbox
  'wallet-resolver': '\u{1F4B3}', // credit card
  creator:      '\u{2705}', // check mark
};

function formatTraceEvent(event: { stage: string; event: string; details?: Record<string, unknown> }): string {
  const icon = STAGE_ICONS[event.stage] ?? '\u{25CF}';
  const detailStr = event.details
    ? ' ' + Object.entries(event.details).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ')
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

  // Small initial delay to let the UI settle
  await new Promise((r) => setTimeout(r, delay));

  console.log(TAG, '\u{250C}\u{2500}\u{2500} Background task started');

  try {
    const isServiceAlive = BackgroundService.isRunning();
    console.log(TAG, `\u{2502}  Service alive: ${isServiceAlive}`);

    console.log(TAG, '\u{2502}  Loading model...');
    const modelStart = Date.now();
    const model = await getOrLoadModel();
    if (!model) {
      console.log(TAG, '\u{2514}\u{2500}\u{2500} Model not available \u{2014} aborting');
      return;
    }
    console.log(TAG, `\u{2502}  Model ready (${Date.now() - modelStart}ms)`);

    let processedCount = 0;
    const queueStart = Date.now();

    while (BackgroundService.isRunning()) {
      const item = peekPending();
      if (!item) {
        console.log(TAG, `\u{2502}`);
        console.log(TAG, `\u{2514}\u{2500}\u{2500} Queue empty. ${processedCount} items processed in ${Date.now() - queueStart}ms`);
        break;
      }

      markProcessing(item.id);

      const preview =
        item.type === 'text' ? `"${item.text.slice(0, 40)}"` :
        item.type === 'notification' ? `[${item.notification.app}] "${item.notification.text.slice(0, 35)}"` :
        `image:${item.imageUri.slice(-25)}`;

      if (item.type === 'notification') {
        console.log(NOTIF_TAG, `Processing notification queue item id=${item.id} app=${item.notification.app}`);
      }

      console.log(TAG, '\u{2502}');
      console.log(TAG, `\u{251C}\u{2500}\u{2500} Item #${processedCount + 1}: ${item.type} ${preview}`);
      console.log(TAG, `\u{2502}  id: ${item.id}`);

      const itemStart = Date.now();

      try {
        const result = await runOrchestration(model, item, {
          trace: (event) => {
            console.log(TAG, formatTraceEvent(event));
          },
        });

        const elapsed = Date.now() - itemStart;

        if (result.created) {
          console.log(TAG, `\u{2502}  \u{2705} Created proposal (${elapsed}ms)${result.proposalId ? ` id=${result.proposalId}` : ''}`);
          processedCount++;
        } else {
          console.log(TAG, `\u{2502}  \u{23ED} Skipped (${elapsed}ms): ${result.reason}`);
        }

        markDone(item.id);
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
    // Task owns its own cleanup: reset flag and stop the service.
    // This must live here (not in startBackgroundProcessor) because start()
    // resolves immediately — the caller's finally would fire before this task runs.
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
 * Safe to call multiple times -- will no-op if already active.
 *
 * BackgroundService.start() resolves immediately once the Android foreground
 * service is up. The task itself (processingTask) owns isRunning + stop()
 * cleanup in its finally block. Do NOT call stop() here.
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
    // start() resolves once the service is up — the task is now running
    // independently. isRunning will be cleared by processingTask's finally.
    console.log(TAG, 'Background service started');
  } catch (e) {
    console.error(TAG, 'Failed to start background service:', e);
    isRunning = false;
    // Fallback: run in foreground context
    console.log(TAG, 'Falling back to foreground processing');
    await processingTask(BACKGROUND_OPTIONS.parameters);
  }
}

/**
 * Stop the background processor if running.
 */
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
