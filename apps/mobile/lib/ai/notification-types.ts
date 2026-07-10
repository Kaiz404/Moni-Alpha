/**
 * Notification types and deterministic helpers (no LLM).
 * Classification / extraction now go through the AI backend client.
 */
import type { CreateProposedTransaction } from '@repo/types';
import {
  buildNotificationContext,
} from '@/lib/ai/notification-context';

export type RawNotification = {
  id: string;
  app: string;
  title: string;
  titleBig?: string;
  text: string;
  bigText?: string;
  subText?: string;
  summaryText?: string;
  extraInfoText?: string;
  time: string;
  receivedAt: string;
};

export type NotificationAnalysisResult =
  | { isTransaction: false; reasoning: string }
  | {
      isTransaction: true;
      reasoning: string;
      confidence: number;
      amount: number;
      currency: string;
      type: 'income' | 'expense';
      merchant: string | null;
      description: string | null;
      walletHint: string | null;
      categoryHint: string | null;
      transactionDate: string;
    };

function notificationText(notification: RawNotification): string {
  return [
    notification.title,
    notification.titleBig,
    notification.text,
    notification.bigText,
    notification.subText,
    notification.summaryText,
    notification.extraInfoText,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Deterministic prefilter: money amount + transfer signal required. */
export function passesTransactionPrefilter(notification: RawNotification): boolean {
  const context = buildNotificationContext(notification);
  return context.signals.hasMoney && context.signals.hasTransferSignal;
}

function inferTypeFromText(input: string): 'income' | 'expense' {
  const lower = input.toLowerCase();
  if (/(credited|received|refund|reversed|cashback received|deposit)/.test(lower)) {
    return 'income';
  }
  return 'expense';
}

export function buildPotentialTransaction(
  notification: RawNotification,
  result: Extract<NotificationAnalysisResult, { isTransaction: true }>,
): CreateProposedTransaction {
  const combined = notificationText(notification);
  const normalizedType =
    result.type === 'income' || result.type === 'expense'
      ? result.type
      : inferTypeFromText(combined);

  return {
    sourceType: 'notification',
    sourceApp: notification.app ?? null,
    sourceText: null,
    sourceImageUri: null,
    notificationTitle: notification.title ?? null,
    notificationBody: notification.bigText || notification.text || null,
    notificationReceivedAt: notification.receivedAt ?? null,
    aiReasoning: result.reasoning,
    aiConfidence: result.confidence,
    walletId: null,
    walletHint: result.walletHint,
    amount: result.amount,
    currency: result.currency,
    type: normalizedType,
    description: result.description,
    merchant: result.merchant,
    categoryId: null,
    categoryHint: result.categoryHint,
    transactionDate: result.transactionDate,
    status: 'pending',
  };
}
