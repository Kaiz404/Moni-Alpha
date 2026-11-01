/**
 * Thin extraction runner: queue item → AI backend client → proposed_transaction.
 * All inference lives on the Go service (apps/backend); see docs/AI.md.
 */
import type { CreateProposedTransaction } from '@repo/types';
import { decimalToMinor } from '@repo/types';
import { getWallets } from '@/lib/supabase/wallets';
import { getCategories } from '@/lib/supabase/categories';
import { createTransaction, getTransactions } from '@/lib/supabase/transactions';
import {
  createProposedTransaction,
  findProposalDuplicate,
} from '@/lib/supabase/proposed-transactions';
import {
  canPairInto,
  findProcessedAlert,
  pairCapture,
  toAbsorbedCapture,
} from '@/lib/proposals/pairing';
import { classifyMovement, isTrackedMovement } from '@/lib/ai/money-movement';
import { matchRoutine } from '@/lib/ai/routine';
import { listAutoAddRules } from '@/lib/supabase/auto-add-rules';
import { getUserId } from '@/lib/supabase/client';
import { getAiClient, type AiWalletContext, type ExtractResult } from '@/lib/ai/client';
import type { ProcessingQueueItem } from '@/lib/ai/processing-queue';
import { extractDateContext, resolveOccurredAt } from '@/lib/ai/occurred-at';
import { saveProposalLocationSnapshot } from '@/lib/ai/proposal-location-cache';
import type { LocationSnapshot } from '@/lib/location/location-snapshot';
import { passesNotificationTransactionPrefilter } from '@/lib/notifications/notification-filter';
import {
  resolveNotificationPackageName,
  enrichNotificationPackage,
} from '@/lib/notifications/notification-package';
import { resolveNotificationCandidates } from '@/lib/notifications/notification-routing';
import type { RawNotification } from '@/lib/ai/notification-types';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import { alertKey, captureAlert } from '@/lib/transactions/alert';
import { FALLBACK_CURRENCY, finalizeProposalWallet } from '@/lib/wallets/proposal-wallet';

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
  /** Set when a routine notification was added to the ledger without review. */
  transactionId?: string;
  /** Set when this capture was counted once with another row. */
  paired?: boolean;
};

/** How much recent history routine detection looks at. */
const ROUTINE_HISTORY_LIMIT = 500;

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

/**
 * Exactly the fields `RawNotification` in apps/backend/internal/extract/types.go reads. The listener
 * also hands over icons, images and grouped messages, and none of that leaves the phone.
 */
function enrichNotificationForExtraction(
  notification: RawNotification & { packageName?: string },
): RawNotification {
  const { id, app, packageName, title, titleBig, text, bigText, subText, summaryText, extraInfoText, time, receivedAt } =
    enrichNotificationPackage(notification);
  return { id, app, packageName, title, titleBig, text, bigText, subText, summaryText, extraInfoText, time, receivedAt };
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
    /** When the user captured the input; relative dates resolve against it. */
    capturedAt: Date;
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
    amountMinor: extraction.amount == null ? null : decimalToMinor(extraction.amount),
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
    // Notifications arrive when the payment happens; processing may lag behind.
    transactionDate:
      source.notificationReceivedAt ?? resolveOccurredAt(extraction.occurredAt, source.capturedAt),
    status: 'pending',
  };
}

/**
 * Prefills category and merchant from the user's own history. A routine notification (the user
 * already categorized ones like it) is added straight to the ledger; everything else, and every
 * manually entered input, becomes a proposal for review. Location only counts for notifications:
 * it is captured when the payment happens, while manual entries are often logged elsewhere.
 */
async function persistProposal(
  proposal: CreateProposedTransaction,
  proposalId: string,
  locationSnapshot: LocationSnapshot | null | undefined,
  logger?: TraceLogger,
): Promise<RunExtractionResult> {
  const automatic = proposal.sourceType === 'notification';
  try {
    const [history, categories, wallets, userId] = await Promise.all([
      getTransactions(undefined, ROUTINE_HISTORY_LIMIT),
      getCategories(),
      getWallets(),
      getUserId(),
    ]);
    const movement = automatic
      ? classifyMovement(
          {
            text: [proposal.notificationTitle, proposal.notificationBody].filter(Boolean).join(' '),
            walletId: proposal.walletId,
            sourceApp: proposal.sourceApp,
            currency: proposal.currency,
            type: proposal.type,
          },
          wallets,
        )
      : null;
    const moved = isTrackedMovement(movement) ? movement : null;
    if (moved) {
      proposal = {
        ...proposal,
        type: 'transfer',
        walletId: moved.fromWalletId,
        transferToWalletId: moved.toWalletId,
        description: moved.label,
        aiReasoning: moved.reason,
      };
    } else if (movement) {
      proposal = { ...proposal, aiReasoning: movement.reason };
    }

    const sameCurrencyWalletIds = new Set(
      wallets.filter((w) => w.currency?.toUpperCase() === proposal.currency).map((w) => w.id),
    );
    const match = matchRoutine(
      {
        type: proposal.type,
        currency: proposal.currency,
        amountMinor: proposal.amountMinor,
        merchant: proposal.merchant,
        location: automatic ? (locationSnapshot ?? null) : null,
        sourceApp: automatic ? proposal.sourceApp : null,
      },
      history,
      new Set(categories.filter((c) => c.isActive).map((c) => c.id)),
      automatic && userId
        ? listAutoAddRules(userId).filter((rule) => sameCurrencyWalletIds.has(rule.walletId))
        : [],
    );
    proposal = {
      ...proposal,
      walletId: match.kind === 'rule' ? match.walletId : proposal.walletId,
      categoryId: proposal.categoryId ?? match.categoryId,
      merchant: proposal.merchant ?? (match.kind === 'rule' ? null : match.merchant),
    };

    const duplicate = await findProposalDuplicate(proposalId, proposal);
    if (duplicate) trace(logger, 'creator', 'duplicate', { kind: duplicate.kind });

    // One payment, two notifications: counted once without review, and both stay in the log.
    if (automatic && duplicate?.confidence === 'high' && canPairInto(duplicate)) {
      try {
        await pairCapture(toAbsorbedCapture({ ...proposal, id: proposalId }), duplicate);
        return { created: true, skipped: false, reason: 'Same payment', paired: true };
      } catch (e) {
        trace(logger, 'creator', 'pairing-failed', { message: e instanceof Error ? e.message : String(e) });
      }
    }

    // Both wallets named without doubt: the board's "Touch 'n Go reload", marked Auto.
    if (moved?.confidence === 'high' && !duplicate && proposal.amountMinor) {
      const transaction = await createTransaction(
        {
          walletId: moved.fromWalletId!,
          amountMinor: proposal.amountMinor,
          type: 'transfer',
          transferToWalletId: moved.toWalletId,
          description: moved.label,
          transactionDate: proposal.transactionDate ?? undefined,
          metadata: {
            ai_suggested: true,
            ai_confidence: proposal.aiConfidence ?? undefined,
            alert: captureAlert(proposal, proposalId),
          },
        },
        'notification',
      );
      trace(logger, 'creator', 'auto-added-transfer', { transactionId: transaction.id });
      return {
        created: true,
        skipped: false,
        reason: 'Added automatically (transfer)',
        transactionId: transaction.id,
      };
    }

    const wallet = wallets.find((w) => w.id === proposal.walletId);
    if (
      automatic &&
      !duplicate &&
      match.kind !== 'proposal' &&
      proposal.amountMinor &&
      (proposal.type === 'income' || proposal.type === 'expense') &&
      wallet?.currency?.toUpperCase() === proposal.currency
    ) {
      const transaction = await createTransaction({
        walletId: wallet.id,
        amountMinor: proposal.amountMinor,
        type: proposal.type,
        categoryId: proposal.categoryId,
        description: proposal.description,
        merchant: proposal.merchant,
        transactionDate: proposal.transactionDate ?? undefined,
        locationLatitude: locationSnapshot?.latitude ?? null,
        locationLongitude: locationSnapshot?.longitude ?? null,
        locationName: locationSnapshot?.name ?? null,
        metadata: {
          ai_suggested: true,
          ai_confidence: proposal.aiConfidence ?? undefined,
          alert: captureAlert(proposal, proposalId),
        },
      }, 'notification');
      trace(logger, 'creator', 'auto-added', { transactionId: transaction.id });
      return {
        created: true,
        skipped: false,
        reason: 'Added automatically (routine)',
        transactionId: transaction.id,
      };
    }

    const created = await createProposedTransaction(proposal, {
      id: proposalId,
    });
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
      proposalId: created.id,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    trace(logger, 'creator', 'error', { message });
    return {
      created: false,
      skipped: true,
      reason: 'Failed to create proposal',
    };
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
  trace(logger, 'extractor', result.status, {
    reason: result.reason,
  });
  return { created: false, skipped: true, reason: result.reason };
}

/** Android's post time, which a redelivery repeats; the listener's own clock when it is missing. */
function postedAt(n: RawNotification): string {
  const posted = Number(n.time);
  return Number.isFinite(posted) && posted > 0 ? new Date(posted).toISOString() : n.receivedAt;
}

function capturedAtOf(item: ProcessingQueueItem): Date {
  const created = new Date(item.createdAt);
  const now = new Date();
  return Number.isNaN(created.getTime()) || created > now ? now : created;
}

export async function runExtraction(
  item: ProcessingQueueItem,
  options?: { trace?: TraceLogger },
): Promise<RunExtractionResult> {
  const logger = options?.trace;
  const client = getAiClient();

  trace(logger, 'extraction', 'start', {
    type: item.type,
    id: item.id,
  });

  try {
    const defaultWalletId = getDefaultWalletId();
    const wallets = await loadWalletContext();
    const capturedAt = capturedAtOf(item);

    switch (item.type) {
      case 'text': {
        const result = await client.extractFromText({
          text: item.text,
          wallets,
          ...extractDateContext(capturedAt),
        });
        const mapped = mapClientResult(result, logger);
        if ('status' in mapped && mapped.status === 'ok') {
          return persistProposal(
            finalizeProposalWallet(
              proposalFromExtraction(
                { sourceType: 'text', sourceText: item.text, capturedAt },
                mapped.extraction,
              ),
              wallets,
              defaultWalletId,
            ),
            item.id,
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
          ...extractDateContext(capturedAt),
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
                  capturedAt,
                },
                mapped.extraction,
              ),
              wallets,
              defaultWalletId,
              { forceDefaultWallet: true },
            ),
            item.id,
            item.locationSnapshot,
            logger,
          );
        }
        return mapped as RunExtractionResult;
      }

      case 'notification': {
        const n = enrichNotificationForExtraction(item.notification);
        // Checked again here, at the last step before the wire: the queue outlives an app update.
        if (!passesNotificationTransactionPrefilter(item.notification)) {
          return {
            created: false,
            skipped: true,
            reason: 'Failed deterministic prefilter',
          };
        }

        const delivery = {
          sourceApp: n.packageName || n.app,
          notificationTitle: n.title,
          notificationBody: n.bigText || n.text || null,
          notificationReceivedAt: postedAt(n),
        };
        const processed = findProcessedAlert(alertKey(delivery), item.id);
        if (processed) return processed;

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
                  ...delivery,
                  capturedAt,
                },
                mapped.extraction,
              ),
              candidates,
              defaultWalletId,
              { currencyFromWallet: false },
            ),
            item.id,
            item.locationSnapshot,
            logger,
          );
        }
        return mapped as RunExtractionResult;
      }

      default:
        return {
          created: false,
          skipped: true,
          reason: 'Unknown item type',
        };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    trace(logger, 'extraction', 'fatal-error', { message: msg });
    return {
      created: false,
      skipped: true,
      reason: `Extraction error: ${msg}`,
    };
  }
}
