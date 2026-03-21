/**
 * On-device AI processor for push notification → transaction proposals.
 *
 * Uses Qwen3.5-0.8B (smaller / faster than the chat model) so processing
 * the background queue doesn't block the main chat experience.
 *
 * Falls back to the chat model (CHAT_MODEL_ID) if the notification model
 * hasn't been downloaded yet — so users get value immediately.
 */
import {
  llama,
  isModelDownloaded,
  getModelPath,
  downloadModel,
} from '@react-native-ai/llama';
import { generateObject } from 'ai';
import { z } from 'zod';
import { MAIN_MODEL_ID } from '@/lib/ai/model-manager';
import type { CreateProposedTransaction } from '@repo/types';

// ─── Model IDs ────────────────────────────────────────────────────────────────

/**
 * Qwen3.5-0.8B GGUF — the dedicated notification-processing model.
 * Smaller and faster than the 3B chat model; ideal for background batch work.
 * If this path changes once the official GGUF repo is published, update here.
 */
export const NOTIFICATION_MODEL_ID =
  'Qwen/Qwen3.5-0.8B-GGUF/qwen3.5-0.8b-q4_k_m.gguf';

// ─── Module-level model state ─────────────────────────────────────────────────

type LoadedModel = ReturnType<typeof llama.languageModel>;

let notificationModel: LoadedModel | null = null;
let notificationModelLoading = false;

// ─── Model lifecycle ──────────────────────────────────────────────────────────

export async function isNotificationModelDownloaded(): Promise<boolean> {
  try {
    return await isModelDownloaded(NOTIFICATION_MODEL_ID);
  } catch {
    return false;
  }
}

export async function downloadNotificationModel(
  onProgress?: (pct: number) => void,
): Promise<void> {
  await downloadModel(NOTIFICATION_MODEL_ID, ({ percentage }) => {
    onProgress?.(Math.round(percentage));
  });
}

export async function getOrLoadNotificationModel(): Promise<LoadedModel | null> {
  if (notificationModel) return notificationModel;
  if (notificationModelLoading) return null;

  try {
    notificationModelLoading = true;
    const downloaded = await isModelDownloaded(NOTIFICATION_MODEL_ID);
    if (!downloaded) return null;

    const path = getModelPath(NOTIFICATION_MODEL_ID);
    const model = llama.languageModel(path, {
      contextParams: { n_ctx: 2048, n_gpu_layers: 99 },
    });
    await model.prepare();
    notificationModel = model;
    return model;
  } catch {
    return null;
  } finally {
    notificationModelLoading = false;
  }
}

/** Load the main model (already downloaded for the AI Chat tab) as a fallback. */
export async function getOrLoadChatModelFallback(): Promise<LoadedModel | null> {
  try {
    const downloaded = await isModelDownloaded(MAIN_MODEL_ID);
    if (!downloaded) return null;

    const path = getModelPath(MAIN_MODEL_ID);
    const model = llama.languageModel(path, {
      contextParams: { n_ctx: 2048, n_gpu_layers: 99 },
    });
    await model.prepare();
    return model;
  } catch {
    return null;
  }
}

export async function unloadNotificationModel(): Promise<void> {
  if (notificationModel) {
    await notificationModel.unload().catch(() => {});
    notificationModel = null;
  }
}

// ─── Notification processing ──────────────────────────────────────────────────

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

export type NotificationAnalysisDebugEvent = {
  event:
    | 'prefilter.signals'
    | 'prefilter.rejected'
    | 'llm.request'
    | 'llm.response.parsed'
    | 'llm.response.invalid'
    | 'llm.error';
  details?: Record<string, unknown>;
};

export const TRANSACTION_DETECTION_SYSTEM_PROMPT = `You are a strict notification transaction detector for a personal finance app.

Your task:
1) Decide if a notification is a real financial transaction.
2) Only classify as transaction when all are true:
   - Source app is a bank, fintech, payment, or wallet app.
   - Message contains a real money amount.
   - Message indicates money movement to or from a person/business/merchant.

Treat as NOT a transaction:
- Promotions, ads, cashback campaigns, coupons, reminders.
- OTP/security alerts/login/device alerts.
- Generic balance snapshots without a transaction event.
- Bills due notices without confirmed payment.

If transaction=true:
- Extract amount as a positive number.
- Infer type:
  - income: credited/received/refund inbound.
  - expense: debited/paid/spent/purchase outbound.
- Currency must be 3-letter ISO when possible (USD, NGN, INR, etc).
- Merchant/counterparty should be null when unknown.
- transaction_date should be ISO datetime if inferable; else current timestamp.

Return ONLY valid JSON that matches the schema.`;

export const NOTIFICATION_TOOL_WORKFLOW_SYSTEM_PROMPT = `You are a strict notification transaction router.

You have exactly two tools:
- get_wallets
- create_transaction

Workflow rules (mandatory):
1) Always call get_wallets first.
2) Compare notification source app/origin with returned wallet names.
3) Only if there is a wallet match, call create_transaction with the exact walletId from get_wallets.
4) If no wallet matches, do not call create_transaction. Return exactly: SKIP_NON_USER_WALLET
5) Do not invent wallet IDs.
6) Keep output concise. If create_transaction is called successfully, final text can be: CREATED
`;

const MONEY_PATTERN =
  /(?:[$€£¥₦₹₩₪₱฿₫₲₴₵₸₽₾R])\s*[\d,]+(?:[.,]\d{1,2})?|[\d,]+(?:[.,]\d{1,2})?\s*(?:USD|EUR|GBP|NGN|ZAR|KES|GHS|UGX|TZS|MYR|RM|SGD|AUD|CAD|CHF|JPY|CNY|INR|BRL|MXN|AED|SAR|QAR|KWD|OMR|BHD)\b/i;

const BANK_WALLET_APP_PATTERN =
  /\b(bank|wallet|pay|payments|upi|momo|mobile money|mpesa|paypal|venmo|cash app|revolut|wise|chime|monzo|opay|kuda|palmpay|moniepoint|branch|stanchart|gtbank|access bank|uba|zenith)\b/i;

const TRANSFER_SIGNAL_PATTERN =
  /\b(credited|debited|received|sent|paid|payment|purchase|spent|withdrawn|withdrawal|deposit|transferred|transfer|refund|dr\b|cr\b|from\s+|to\s+|at\s+|via\s+|merchant|beneficiary|sender|receiver)\b/i;

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

export function passesTransactionPrefilter(notification: RawNotification): boolean {
  const text = notificationText(notification);
  // Prefilter now only requires a money amount and a transfer signal.
  // App-name checks are removed — wallet matching is handled later via get_wallets.
  return MONEY_PATTERN.test(text) && TRANSFER_SIGNAL_PATTERN.test(text);
}

function inferTypeFromText(input: string): 'income' | 'expense' {
  const lower = input.toLowerCase();
  if (
    /(credited|received|refund|reversed|cashback received|deposit)/.test(lower)
  ) {
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

const notificationSchema = z.discriminatedUnion('is_transaction', [
  z.object({
    is_transaction: z.literal(false),
    reasoning: z.string(),
  }),
  z.object({
    is_transaction: z.literal(true),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1),
    amount: z.number().positive(),
    currency: z.string(),
    type: z.enum(['income', 'expense', 'transfer']).optional(),
    merchant: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    wallet_hint: z.string().nullable().optional(),
    category_hint: z.string().nullable().optional(),
    transaction_date: z.string().optional(),
  }),
]);

/**
 * Run the notification through the AI model.
 * Returns null if the model fails or produces unparseable output.
 */
export async function analyzeNotification(
  notification: RawNotification,
  model: LoadedModel,
  onDebug?: (debugEvent: NotificationAnalysisDebugEvent) => void,
): Promise<NotificationAnalysisResult | null> {
  try {
    const mergedText = notificationText(notification);
    const hasMoneySignal = MONEY_PATTERN.test(mergedText);
    const hasTransferSignal = TRANSFER_SIGNAL_PATTERN.test(mergedText);

    onDebug?.({
      event: 'prefilter.signals',
      details: {
        notificationId: notification.id,
        app: notification.app,
        hasMoneySignal,
        hasTransferSignal,
        textLength: mergedText.length,
      },
    });

    if (!hasMoneySignal || !hasTransferSignal) {
      onDebug?.({
        event: 'prefilter.rejected',
        details: {
          notificationId: notification.id,
          reason: 'missing_required_signals',
        },
      });
      return {
        isTransaction: false,
        reasoning: 'Failed deterministic prefilter (app/source, amount, or transfer signal missing)',
      };
    }

    const body = notification.bigText || notification.text || notification.subText || notification.summaryText || '';
    const title = notification.titleBig || notification.title || '';

    onDebug?.({
      event: 'llm.request',
      details: {
        notificationId: notification.id,
        app: notification.app,
        hasTitle: Boolean(title),
        hasBody: Boolean(body),
      },
    });

    const { object } = await generateObject({
      model,
      schema: notificationSchema,
      system: TRANSACTION_DETECTION_SYSTEM_PROMPT,
      prompt: [
        'Analyze this Android push notification and classify whether it is a real transaction.',
        'Use only the notification content. If unsure, classify as not a transaction.',
        '',
        `App: ${notification.app || 'Unknown'}`,
        `Title: ${title}`,
        `Body: ${body}`,
        `Time: ${notification.time || notification.receivedAt}`,
      ].join('\n'),
    });

    if (!object || typeof object.is_transaction !== 'boolean') {
      onDebug?.({
        event: 'llm.response.invalid',
        details: {
          notificationId: notification.id,
          reason: 'missing_or_invalid_object',
        },
      });
      return null;
    }

    onDebug?.({
      event: 'llm.response.parsed',
      details: {
        notificationId: notification.id,
        isTransaction: object.is_transaction,
        confidence: object.is_transaction ? object.confidence : null,
        amount: object.is_transaction ? object.amount : null,
        currency: object.is_transaction ? object.currency : null,
      },
    });

    if (!object.is_transaction) {
      return { isTransaction: false, reasoning: object.reasoning ?? 'Not a transaction' };
    }

    const type = object.type === 'income' ? 'income' : 'expense';

    return {
      isTransaction: true,
      reasoning: object.reasoning,
      confidence: object.confidence,
      amount: object.amount,
      currency: object.currency.toUpperCase().slice(0, 3),
      type,
      merchant: object.merchant ?? null,
      description: object.description ?? null,
      walletHint: object.wallet_hint ?? null,
      categoryHint: object.category_hint ?? null,
      transactionDate: object.transaction_date ?? new Date().toISOString(),
    };
  } catch (error) {
    onDebug?.({
      event: 'llm.error',
      details: {
        notificationId: notification.id,
        message: error instanceof Error ? error.message : 'unknown_error',
      },
    });
    return null;
  }
}
