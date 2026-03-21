import {
  getAll,
  getPendingCount,
  pruneCompleted,
  type ProcessingQueueItem,
} from '@/lib/ai/processing-queue';
import { isBackgroundProcessorRunning } from '@/lib/ai/background-processor';
import BackgroundService from 'react-native-background-actions';
import type { LogFn, DebugTestResult } from './types';

export type QueueSnapshot = {
  items: ProcessingQueueItem[];
  pending: number;
  processing: number;
  done: number;
  error: number;
  total: number;
  processorRunning: boolean;
  serviceRunning: boolean;
};

export function getQueueSnapshot(): QueueSnapshot {
  const items = getAll();
  return {
    items,
    pending: items.filter((i) => i.status === 'pending').length,
    processing: items.filter((i) => i.status === 'processing').length,
    done: items.filter((i) => i.status === 'done').length,
    error: items.filter((i) => i.status === 'error').length,
    total: items.length,
    processorRunning: isBackgroundProcessorRunning(),
    serviceRunning: BackgroundService.isRunning(),
  };
}

export async function runQueueInspection(log: LogFn): Promise<DebugTestResult> {
  const snap = getQueueSnapshot();

  log('=== Queue Inspection ===');
  log(`Total items: ${snap.total}`);
  log(`  Pending:    ${snap.pending}`);
  log(`  Processing: ${snap.processing}`);
  log(`  Done:       ${snap.done}`);
  log(`  Error:      ${snap.error}`);
  log('');
  log(`Processor running: ${snap.processorRunning ? 'YES' : 'NO'}`);
  log(`BG service running: ${snap.serviceRunning ? 'YES' : 'NO'}`);

  if (snap.items.length > 0) {
    log('');
    log('--- Recent items (last 10) ---');
    for (const item of snap.items.slice(-10)) {
      const preview =
        item.type === 'text'
          ? item.text.slice(0, 50)
          : item.type === 'notification'
            ? item.notification.text.slice(0, 50)
            : item.imageUri.slice(-35);
      log(`[${item.status.toUpperCase().padEnd(10)}] ${item.type} | ${preview}`);
    }
  }

  return {
    success: true,
    summary: `${snap.total} items (${snap.pending} pending, ${snap.processing} active)`,
  };
}

export async function pruneQueue(log: LogFn): Promise<DebugTestResult> {
  const before = getAll().length;
  pruneCompleted();
  const after = getAll().length;
  const removed = before - after;
  log(`Pruned ${removed} items (entire queue cleared)`);
  return { success: true, summary: `${removed} items removed (queue cleared)` };
}
