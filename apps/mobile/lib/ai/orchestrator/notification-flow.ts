import type { CreateProposedTransaction } from '@repo/types';
import {
  analyzeNotification,
  buildPotentialTransaction,
  passesTransactionPrefilter,
  type NotificationAnalysisDebugEvent,
  type NotificationAnalysisResult,
  type RawNotification,
} from '@/lib/ai/notification-processor';
import { walletResolutionSubAgent } from './wallet-resolver';
import type { TraceEvent, TraceLogger, OrchestrationResult } from './types';
import type { LocationSnapshot } from '@/lib/location/location-snapshot';
import { saveProposalLocationSnapshot } from '@/lib/ai/proposal-location-cache';

function trace(
  logger: TraceLogger | undefined,
  stage: TraceEvent['stage'],
  event: string,
  details?: Record<string, unknown>,
) {
  try { logger?.({ stage, event, details }); } catch { /* never break orchestration */ }
}

type Adapters = {
  getWallets: () => Promise<{ id: string; name?: string | null }[]>;
  createProposedTransaction: (tx: CreateProposedTransaction) => Promise<unknown>;
};

async function classifyAndExtractNotification(
  model: any,
  notification: RawNotification,
  logger?: TraceLogger,
): Promise<{
  isTransaction: boolean;
  proposal: CreateProposedTransaction | null;
  reason: string;
}> {
  trace(logger, 'classifier', 'start', {
    id: notification.id,
    app: notification.app,
  });

  let classification = await analyzeNotification(
    notification,
    model,
    (debugEvent: NotificationAnalysisDebugEvent) => {
      trace(logger, 'classifier', `analyze.${debugEvent.event}`, debugEvent.details);
    },
  );

  if (!classification) {
    classification = fallbackClassify(notification);
    trace(logger, 'classifier', 'fallback-used', {
      isTransaction: classification.isTransaction,
    });
  }

  if (!classification.isTransaction) {
    return { isTransaction: false, proposal: null, reason: classification.reasoning };
  }

  if (!Number.isFinite(classification.amount) || classification.amount <= 0) {
    const fb = fallbackClassify(notification);
    if (!fb.isTransaction) {
      return { isTransaction: false, proposal: null, reason: 'Invalid amount' };
    }
    classification = fb;
  }

  const proposal = buildPotentialTransaction(notification, classification);
  (proposal as any).sourceType = 'notification';
  return { isTransaction: true, proposal, reason: classification.reasoning };
}

function fallbackClassify(notification: RawNotification): NotificationAnalysisResult {
  const merged = [
    notification.title, notification.titleBig, notification.text,
    notification.bigText, notification.subText, notification.summaryText,
    notification.extraInfoText,
  ].filter(Boolean).join(' ');

  if (!passesTransactionPrefilter(notification)) {
    return { isTransaction: false, reasoning: 'Failed deterministic prefilter' };
  }

  const money = merged.match(
    /(?:[$€£¥₦₹]|USD|EUR|GBP|NGN|INR|KES|ZAR|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY)?\s*([\d,]+(?:[.,]\d{1,2})?)/i,
  );
  const amount = money ? Number(String(money[1]).replace(/,/g, '')) : NaN;

  if (!Number.isFinite(amount) || amount <= 0) {
    return { isTransaction: false, reasoning: 'Could not extract valid amount' };
  }

  const currencyFromCode = merged.match(
    /\b(USD|EUR|GBP|NGN|INR|KES|ZAR|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY)\b/i,
  )?.[1]?.toUpperCase();
  const symbolMap: Record<string, string> = {
    '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₦': 'NGN', '₹': 'INR',
  };
  const currencyFromSymbol = merged.match(/[$€£¥₦₹]/)?.[0] ?? null;
  const currency =
    currencyFromCode ??
    (currencyFromSymbol ? symbolMap[currencyFromSymbol] : undefined) ??
    'MYR';

  const lower = merged.toLowerCase();
  const isIncome = /(credited|received|refund|deposit|inbound|salary)/.test(lower);

  return {
    isTransaction: true,
    reasoning: 'Fallback: deterministic signal extraction',
    confidence: 0.35,
    amount,
    currency,
    type: isIncome ? 'income' : 'expense',
    merchant: null,
    description: merged.slice(0, 120) || null,
    walletHint: notification.app || null,
    categoryHint: null,
    transactionDate: notification.receivedAt || new Date().toISOString(),
  };
}

export async function runNotificationFlow(
  model: any,
  notification: RawNotification,
  adapters: Adapters,
  locationSnapshot?: LocationSnapshot | null,
  logger?: TraceLogger,
): Promise<OrchestrationResult> {
  trace(logger, 'orchestrator', 'flow.notification', {
    id: notification.id,
    app: notification.app,
  });

  const { isTransaction, proposal, reason } =
    await classifyAndExtractNotification(model, notification, logger);

  if (!isTransaction || !proposal) {
    return { created: false, skipped: true, reason };
  }

  if (typeof proposal.amount !== 'number' || proposal.amount <= 0) {
    return { created: false, skipped: true, reason: 'Invalid amount in proposal' };
  }

  const normalizedType: 'income' | 'expense' =
    proposal.type === 'income' ? 'income' : 'expense';

  const walletResult = await walletResolutionSubAgent(
    model,
    notification.app ?? proposal.walletHint,
    proposal.amount,
    normalizedType,
    adapters,
    logger,
  );

  if (!walletResult.shouldCreate) {
    return { created: false, skipped: true, reason: walletResult.reason };
  }

  // For notification-origin proposals, wallet mapping is mandatory.
  // If no concrete wallet can be resolved, skip creation.
  if (!walletResult.walletId) {
    trace(logger, 'creator', 'notification.skipped.no-wallet', {
      notificationId: notification.id,
      reason: walletResult.reason,
    });
    return {
      created: false,
      skipped: true,
      reason: 'No wallet match — notification ignored',
    };
  }

  const finalProposal: CreateProposedTransaction = {
    ...proposal,
    sourceType: 'notification',
    sourceText: null,
    sourceImageUri: null,
    walletId: walletResult.walletId,
  };

  try {
    const created = await adapters.createProposedTransaction(finalProposal);
    const proposalId = (created as any)?.id;
    if (proposalId && locationSnapshot) {
      saveProposalLocationSnapshot(proposalId, locationSnapshot);
    }
    trace(logger, 'creator', 'notification.created', {
      walletId: walletResult.walletId,
      notificationId: notification.id,
    });
    return {
      created: true,
      skipped: false,
      reason: 'Created from notification',
      proposalId,
    };
  } catch (e) {
    trace(logger, 'creator', 'notification.error', {
      message: e instanceof Error ? e.message : String(e),
    });
    return { created: false, skipped: true, reason: 'Failed to create proposal' };
  }
}
