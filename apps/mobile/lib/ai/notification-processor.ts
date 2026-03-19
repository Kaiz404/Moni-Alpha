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
import { generateText } from 'ai';
import { z } from 'zod';
import { CHAT_MODEL_ID } from '@/hooks/use-llama-model';

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

/** Load the chat model (already downloaded for the AI Chat tab) as a fallback. */
export async function getOrLoadChatModelFallback(): Promise<LoadedModel | null> {
  try {
    const downloaded = await isModelDownloaded(CHAT_MODEL_ID);
    if (!downloaded) return null;

    const path = getModelPath(CHAT_MODEL_ID);
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
): Promise<NotificationAnalysisResult | null> {
  try {
    const body = notification.bigText || notification.text || notification.subText || notification.summaryText || '';
    const title = notification.titleBig || notification.title || '';

    const result = await generateText({
      model,
      prompt: [
        'You are a financial transaction detector for a personal finance app.',
        'Analyze the following push notification and decide whether it represents a real financial transaction',
        '(payment, purchase, bank debit/credit, mobile-money transfer, wallet top-up, etc.)',
        'or something else (promotion, offer, OTP, general alert).',
        '',
        `App: ${notification.app || 'Unknown'}`,
        `Title: ${title}`,
        `Body: ${body}`,
        `Time: ${notification.time || notification.receivedAt}`,
        '',
        'Respond strictly as JSON that matches the provided schema.',
      ].join('\n'),
      output: 'json',
      schema: notificationSchema,
    } as any);

    const object = (result as any).object as z.infer<typeof notificationSchema>;

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
  } catch {
    return null;
  }
}
