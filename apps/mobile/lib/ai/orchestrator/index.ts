/**
 * Unified AI Orchestrator
 *
 * Processes three input types through a common pipeline:
 *   1. Text input   → detail extraction → wallet resolution → create proposal
 *   2. Image input  → VL model extraction → wallet resolution → create proposal
 *   3. Notification  → classification → detail extraction → wallet resolution → create proposal
 *
 * All flows produce proposed_transactions — never real transactions.
 * See ORCHESTRATOR.md for full architecture documentation.
 */
import type { CreateProposedTransaction } from '@repo/types';
import { getWallets } from '@/lib/supabase/wallets';
import { createProposedTransaction } from '@/lib/supabase/proposed-transactions';
import type { ProcessingQueueItem } from '../processing-queue';
import { runTextFlow } from './text-flow';
import { runImageFlow } from './image-flow';
import { runNotificationFlow } from './notification-flow';
import type {
  TraceEvent,
  TraceLogger,
  OrchestrationOptions,
  OrchestrationResult,
} from './types';

function trace(
  logger: TraceLogger | undefined,
  stage: TraceEvent['stage'],
  event: string,
  details?: Record<string, unknown>,
) {
  try { logger?.({ stage, event, details }); } catch { /* never break orchestration */ }
}

function resolveAdapters(options?: OrchestrationOptions) {
  return {
    getWallets: options?.adapters?.getWallets ?? getWallets,
    createProposedTransaction:
      options?.adapters?.createProposedTransaction ??
      ((tx: CreateProposedTransaction) => createProposedTransaction(tx)),
  };
}

export async function runOrchestration(
  model: any,
  item: ProcessingQueueItem,
  options?: OrchestrationOptions,
): Promise<OrchestrationResult> {
  const logger = options?.trace;
  const adapters = resolveAdapters(options);

  trace(logger, 'orchestrator', 'start', { type: item.type, id: item.id });

  try {
    switch (item.type) {
      case 'text':
        return await runTextFlow(model, item.text, adapters, item.locationSnapshot, logger);

      case 'image':
        return await runImageFlow(
          model,
          item.imageUri,
          item.userContext,
          adapters,
          item.locationSnapshot,
          logger,
        );

      case 'notification':
        return await runNotificationFlow(
          model,
          item.notification,
          adapters,
          item.locationSnapshot,
          logger,
        );

      default:
        return { created: false, skipped: true, reason: 'Unknown item type' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    trace(logger, 'orchestrator', 'fatal-error', { message: msg });
    return { created: false, skipped: true, reason: `Orchestration error: ${msg}` };
  }
}

// Re-exports for backward compatibility
export type {
  TraceEvent,
  TraceLogger,
  OrchestrationOptions,
  OrchestrationResult,
} from './types';

export type {
  RawNotification,
  NotificationAnalysisResult,
} from '@/lib/ai/notification-processor';
