/**
 * Thin orchestration: queue item → AI backend client → proposed_transaction.
 * All inference lives on the Go service (apps/backend); see docs/AI.md.
 */
import type { CreateProposedTransaction } from '@repo/types';
import { getWallets } from '@/lib/supabase/wallets';
import { createProposedTransaction } from '@/lib/supabase/proposed-transactions';
import { getAiClient, type AiWalletContext, type ExtractResult } from '@/lib/ai/client';
import type { ProcessingQueueItem } from '@/lib/ai/processing-queue';
import { saveProposalLocationSnapshot } from '@/lib/ai/proposal-location-cache';
import type { LocationSnapshot } from '@/lib/location/location-snapshot';
import { passesTransactionPrefilter } from '@/lib/ai/notification-types';

export type TraceEvent = {
  stage: 'orchestrator' | 'extractor' | 'creator';
  event: string;
  details?: Record<string, unknown>;
};

export type TraceLogger = (event: TraceEvent) => void;

export type OrchestrationResult = {
  created: boolean;
  skipped: boolean;
  reason: string;
  proposalId?: string;
};

function trace(
  logger: TraceLogger | undefined,
  stage: TraceEvent['stage'],
  event: string,
  details?: Record<string, unknown>,
) {
  try {
    logger?.({ stage, event, details });
  } catch {
    /* never break orchestration */
  }
}

async function loadWalletContext(): Promise<AiWalletContext[]> {
  const wallets = await getWallets();
  return wallets.map((w) => ({
    id: w.id,
    name: w.name ?? '',
    type: w.type ?? null,
    currency: w.currency ?? null,
  }));
}

function proposalFromExtraction(
  source: {
    sourceType: 'text' | 'image' | 'notification';
    sourceText?: string | null;
    sourceImageUri?: string | null;
    sourceApp?: string | null;
    notificationTitle?: string | null;
    notificationBody?: string | null;
    notificationReceivedAt?: string | null;
  },
  extraction: Extract<ExtractResult, { status: 'ok' }>['extraction'],
): CreateProposedTransaction {
  return {
    sourceType: source.sourceType,
    sourceApp: source.sourceApp ?? null,
    sourceText: source.sourceText ?? null,
    sourceImageUri: source.sourceImageUri ?? null,
    notificationTitle: source.notificationTitle ?? null,
    notificationBody: source.notificationBody ?? null,
    notificationReceivedAt: source.notificationReceivedAt ?? null,
    aiReasoning: extraction.reasoning,
    aiConfidence: extraction.confidence,
    walletId: extraction.walletId,
    walletHint: extraction.walletHint,
    amount: extraction.amount,
    currency: extraction.currency || 'MYR',
    type: extraction.type,
    description:
      extraction.description ??
      (extraction.type === 'income' ? 'Income' : 'Expense'),
    merchant: extraction.merchant,
    categoryId: null,
    categoryHint: extraction.categoryHint,
    transactionDate: new Date().toISOString(),
    status: 'pending',
  };
}

async function persistProposal(
  proposal: CreateProposedTransaction,
  locationSnapshot: LocationSnapshot | null | undefined,
  logger?: TraceLogger,
): Promise<OrchestrationResult> {
  try {
    const created = await createProposedTransaction(proposal);
    const proposalId = (created as { id?: string })?.id;
    if (proposalId && locationSnapshot) {
      saveProposalLocationSnapshot(proposalId, locationSnapshot);
    }
    trace(logger, 'creator', 'created', {
      proposalId,
      walletId: proposal.walletId,
      sourceType: proposal.sourceType,
    });
    return {
      created: true,
      skipped: false,
      reason: `Created from ${proposal.sourceType}`,
      proposalId,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    trace(logger, 'creator', 'error', { message });
    return { created: false, skipped: true, reason: 'Failed to create proposal' };
  }
}

function mapClientResult(
  result: ExtractResult,
  logger?: TraceLogger,
): OrchestrationResult | Extract<ExtractResult, { status: 'ok' }> {
  if (result.status === 'ok') {
    trace(logger, 'extractor', 'ok', {
      amount: result.extraction.amount,
      type: result.extraction.type,
    });
    return result;
  }
  trace(logger, 'extractor', result.status, { reason: result.reason });
  return { created: false, skipped: true, reason: result.reason };
}

export async function runOrchestration(
  item: ProcessingQueueItem,
  options?: { trace?: TraceLogger },
): Promise<OrchestrationResult> {
  const logger = options?.trace;
  const client = getAiClient();

  trace(logger, 'orchestrator', 'start', { type: item.type, id: item.id });

  try {
    const wallets = await loadWalletContext();

    switch (item.type) {
      case 'text': {
        const result = await client.extractFromText({ text: item.text, wallets });
        const mapped = mapClientResult(result, logger);
        if ('status' in mapped && mapped.status === 'ok') {
          return persistProposal(
            proposalFromExtraction(
              { sourceType: 'text', sourceText: item.text },
              mapped.extraction,
            ),
            item.locationSnapshot,
            logger,
          );
        }
        return mapped as OrchestrationResult;
      }

      case 'image': {
        const result = await client.extractFromImage({
          imageUri: item.imageUri,
          userContext: item.userContext,
          wallets,
        });
        const mapped = mapClientResult(result, logger);
        if ('status' in mapped && mapped.status === 'ok') {
          return persistProposal(
            proposalFromExtraction(
              {
                sourceType: 'image',
                sourceText: item.userContext ?? null,
                sourceImageUri: item.imageUri,
              },
              mapped.extraction,
            ),
            item.locationSnapshot,
            logger,
          );
        }
        return mapped as OrchestrationResult;
      }

      case 'notification': {
        if (!passesTransactionPrefilter(item.notification)) {
          return {
            created: false,
            skipped: true,
            reason: 'Failed deterministic prefilter',
          };
        }

        const result = await client.extractFromNotification({
          notification: item.notification,
          wallets,
        });
        const mapped = mapClientResult(result, logger);
        if ('status' in mapped && mapped.status === 'ok') {
          const n = item.notification;
          // Notifications historically required a resolved wallet.
          if (!mapped.extraction.walletId) {
            return {
              created: false,
              skipped: true,
              reason: 'No wallet match — notification ignored',
            };
          }
          return persistProposal(
            proposalFromExtraction(
              {
                sourceType: 'notification',
                sourceApp: n.app,
                notificationTitle: n.title,
                notificationBody: n.bigText || n.text || null,
                notificationReceivedAt: n.receivedAt,
              },
              mapped.extraction,
            ),
            item.locationSnapshot,
            logger,
          );
        }
        return mapped as OrchestrationResult;
      }

      default:
        return { created: false, skipped: true, reason: 'Unknown item type' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    trace(logger, 'orchestrator', 'fatal-error', { message: msg });
    return { created: false, skipped: true, reason: `Orchestration error: ${msg}` };
  }
}
