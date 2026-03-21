import { randomUUID } from 'expo-crypto';
import {
  enqueue,
  getPendingCount,
  getAll,
  pruneCompleted,
  type ProcessingQueueItem,
} from '@/lib/ai/processing-queue';
import {
  startBackgroundProcessor,
  stopBackgroundProcessor,
  isBackgroundProcessorRunning,
} from '@/lib/ai/background-processor';
import { areModelsDownloaded } from '@/lib/ai/model-manager';
import type { LogFn, DebugTestResult } from './types';

export async function runLLMBackgroundTest(log: LogFn): Promise<DebugTestResult> {
  const { main } = await areModelsDownloaded();
  if (!main) {
    log('Model not downloaded — LLM background test cannot run');
    return { success: false, summary: 'Model not downloaded' };
  }

  log('Enqueueing test item: "Coffee at Starbucks 12.50 USD"');
  enqueue({
    id: randomUUID(),
    type: 'text',
    text: 'Coffee at Starbucks 12.50 USD',
    createdAt: new Date().toISOString(),
    status: 'pending',
  });

  log('Enqueueing test item: "Transfer 500 MYR to savings"');
  enqueue({
    id: randomUUID(),
    type: 'text',
    text: 'Transfer 500 MYR to savings',
    createdAt: new Date().toISOString(),
    status: 'pending',
  });

  const pending = getPendingCount();
  log(`Queue now has ${pending} pending item(s). Starting processor...`);
  log('You can EXIT the app — the foreground service will keep running.');

  try {
    await startBackgroundProcessor();
    log('Processor finished (or fell back to foreground)');
    return { success: true, summary: `Processed with ${pending} items queued` };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    log(`Processor threw: ${msg}`);
    return { success: false, summary: `Processor error: ${msg}` };
  }
}

export async function stopLLMProcessor(log: LogFn): Promise<DebugTestResult> {
  log('Stopping background processor...');
  await stopBackgroundProcessor();
  log('Stopped');
  return { success: true, summary: 'Processor stopped' };
}

export function getQueueSnapshot(): {
  items: ProcessingQueueItem[];
  pending: number;
  processing: number;
  done: number;
  error: number;
  isProcessorRunning: boolean;
} {
  const items = getAll();
  return {
    items,
    pending: items.filter((i) => i.status === 'pending').length,
    processing: items.filter((i) => i.status === 'processing').length,
    done: items.filter((i) => i.status === 'done').length,
    error: items.filter((i) => i.status === 'error').length,
    isProcessorRunning: isBackgroundProcessorRunning(),
  };
}

export function pruneQueue(log: LogFn): void {
  pruneCompleted();
  log('Queue pruned (completed/errored items removed)');
}
