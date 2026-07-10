import { randomUUID } from 'expo-crypto';
import {
  enqueue,
  getPendingCount,
} from '@/lib/ai/processing-queue';
import {
  startBackgroundProcessor,
  stopBackgroundProcessor,
} from '@/lib/ai/background-processor';
import type { LogFn, DebugTestResult } from './types';

export async function runLLMBackgroundTest(log: LogFn): Promise<DebugTestResult> {
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
  log('AI backend is mocked — items will be marked unavailable/error until Go service exists.');

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
