/**
 * Thin extraction runner: queue item → AI backend client → proposed_transaction.
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
import { resolveNotificationPackageName, enrichNotificationPackage } from '@/lib/notifications/notification-package';
import { resolveNotificationCandidates } from '@/lib/notifications/notification-routing';
import type { RawNotification } from '@/lib/ai/notification-types';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import {
  FALLBACK_CURRENCY,
  finalizeProposalWallet,
} from '@/lib/wallets/proposal-wallet';

export type TraceEvent = {
  stage: 'extraction' | 'extractor' | 'creator';
  event: string;
  details?: Record<string, unknown>;
};

export type TraceLogger = (event: TraceEvent) => void;

export type RunExtractionResult = {
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
    /* never break extraction */
  }
}

function enrichNotificationForExtraction(
  notification: RawNotification & { packageName?: string },
): RawNotification {
  return enrichNotificationPackage(notification);
}

async function loadWalletContext(): Promise<AiWalletContext[]> {
  const wallets = await getWallets();
  return wallets.map((w) => ({
    id: w.id,
    name: w.name ?? '',
    type: w.type ?? null,
    currency: w.currency ?? null,
    accountHint: w.notificationAccountHint ?? null,
  }));
}

async function loadWalletsForNotificationRouting() {
  const wallets = await getWallets();
  return wallets.map((w) => ({
    id: w.id,
    name: w.name ?? '',
    type: w.type ?? null,
    currency: w.currency ?? null,
    notificationPackage: w.notificationPackage ?? null,
    notificationAppLabel: w.notificationAppLabel ?? null,
    notificationAccountHint: w.notificationAccountHint ?? null,
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
    transferToWalletId: extraction.transferToWalletId,
    transferToWalletHint: extraction.transferToWalletHint,
    amount: extraction.amount,
    currency:
      source.sourceType === 'notification'
        ? extraction.currency || FALLBACK_CURRENCY
        : FALLBACK_CURRENCY,
    type: extraction.type,
    description:
      extraction.description ??
      (extraction.type === 'income'
        ? 'Income'
        : extraction.type === 'transfer'
          ? 'Transfer'
          : 'Expense'),
    merchant: extraction.type === 'transfer' ? null : extraction.merchant,
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
): Promise<RunExtractionResult> {
  try {
    const created = await createProposedTransaction(proposal);
    const proposalId = (created as { id?: string })?.id;
    if (proposalId && locationSnapshot) {
      saveProposalLocationSnapshot(proposalId, locationSnapshot);
    }
    trace(logger, 'creator', 'created', {
      proposalId,
      walletId: proposal.walletId,
      currency: proposal.currency,
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
): RunExtractionResult | Extract<ExtractResult, { status: 'ok' }> {
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

export async function runExtraction(
  item: ProcessingQueueItem,
  options?: { trace?: TraceLogger },
): Promise<RunExtractionResult> {
  const logger = options?.trace;
  const client = getAiClient();

  trace(logger, 'extraction', 'start', { type: item.type, id: item.id });

  try {
    const defaultWalletId = getDefaultWalletId();
    const wallets = await loadWalletContext();

    switch (item.type) {
      case 'text': {
        const result = await client.extractFromText({ text: item.text, wallets });
        const mapped = mapClientResult(result, logger);
        if ('status' in mapped && mapped.status === 'ok') {
          return persistProposal(
            finalizeProposalWallet(
              proposalFromExtraction(
                { sourceType: 'text', sourceText: item.text },
                mapped.extraction,
              ),
              wallets,
              defaultWalletId,
            ),
            item.locationSnapshot,
            logger,
          );
        }
        return mapped as RunExtractionResult;
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
            finalizeProposalWallet(
              proposalFromExtraction(
                {
                  sourceType: 'image',
                  sourceText: item.userContext ?? null,
                  sourceImageUri: item.imageUri,
                },
                mapped.extraction,
              ),
              wallets,
              defaultWalletId,
              { forceDefaultWallet: true },
            ),
            item.locationSnapshot,
            logger,
          );
        }
        return mapped as RunExtractionResult;
      }

      case 'notification': {
        const n = enrichNotificationForExtraction(item.notification);
        if (!passesTransactionPrefilter(n)) {
          return {
            created: false,
            skipped: true,
            reason: 'Failed deterministic prefilter',
          };
        }

        const packageName = resolveNotificationPackageName(n);
        const walletLinks = await loadWalletsForNotificationRouting();
        const { candidates, lockedWalletId } = resolveNotificationCandidates(
          packageName,
          walletLinks,
        );

        if (candidates.length === 0) {
          return {
            created: false,
            skipped: true,
            reason: 'No wallet linked to notification app',
          };
        }

        const result = await client.extractFromNotification({
          notification: n,
          wallets: candidates,
          lockedWalletId,
        });
        const mapped = mapClientResult(result, logger);
        if ('status' in mapped && mapped.status === 'ok') {
          return persistProposal(
            finalizeProposalWallet(
              proposalFromExtraction(
                {
                  sourceType: 'notification',
                  sourceApp: n.packageName || n.app,
                  notificationTitle: n.title,
                  notificationBody: n.bigText || n.text || null,
                  notificationReceivedAt: n.receivedAt,
                },
                mapped.extraction,
              ),
              candidates,
              defaultWalletId,
              { currencyFromWallet: false },
            ),
            item.locationSnapshot,
            logger,
          );
        }
        return mapped as RunExtractionResult;
      }

      default:
        return { created: false, skipped: true, reason: 'Unknown item type' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    trace(logger, 'extraction', 'fatal-error', { message: msg });
    return { created: false, skipped: true, reason: `Extraction error: ${msg}` };
  }
}
