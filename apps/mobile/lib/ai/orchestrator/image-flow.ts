import { generateObject } from 'ai';
import type { z } from 'zod';
import type { CreateProposedTransaction } from '@repo/types';
import { isVisionMultimodalEnabled } from '@/lib/ai/model-manager';
import { RECEIPT_EXTRACTION_PROMPT, extractionResultSchema } from './prompts';
import { textExtractionSubAgent } from './text-flow';
import { walletResolutionSubAgent } from './wallet-resolver';
import type { TraceEvent, TraceLogger, OrchestrationResult } from './types';

/** Max time for one VL inference — avoids indefinite hangs if native stack stalls. */
const VISION_GENERATE_OBJECT_MS = 180_000;

function trace(
  logger: TraceLogger | undefined,
  stage: TraceEvent['stage'],
  event: string,
  details?: Record<string, unknown>,
) {
  try { logger?.({ stage, event, details }); } catch { /* never break orchestration */ }
}

function mediaTypeForUri(uri: string): 'image/jpeg' | 'image/png' {
  const u = uri.toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

/**
 * Native llama.rn completion with image_paths — often more reliable than AI SDK multimodal
 * for the same loaded VL model. Parse JSON from text.
 */
async function nativeVisionExtract(
  model: any,
  imageUri: string,
  userContext: string | undefined,
  logger?: TraceLogger,
): Promise<z.infer<typeof extractionResultSchema> | null> {
  const context = model.getContext?.();
  if (!context?.completion) {
    trace(logger, 'extractor', 'native-vision.no-context', {});
    return null;
  }

  trace(logger, 'extractor', 'native-vision.completion', {});

  const prompt = [
    RECEIPT_EXTRACTION_PROMPT,
    userContext ? `User context: ${userContext}` : '',
    'Analyze the receipt image and return ONLY valid JSON matching:',
    '{"amount": number|null, "type": "income"|"expense"|null, "currency": string|null, "merchant": string|null, "description": string|null, "wallet_hint": string|null, "category_hint": string|null}',
  ]
    .filter(Boolean)
    .join('\n');

  const response = (await withTimeout(
    context.completion({
      prompt,
      image_paths: [imageUri],
      n_predict: 512,
      temperature: 0,
      stop: ['\n\n'],
    }),
    VISION_GENERATE_OBJECT_MS,
    'native-vision-completion',
  )) as { text?: string } | undefined;

  const text = response?.text ?? '';
  trace(logger, 'extractor', 'native-vision.raw', { textLength: text.length });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = extractionResultSchema.safeParse(JSON.parse(jsonMatch[0]));
  if (!parsed.success) return null;
  trace(logger, 'extractor', 'native-vision.parsed', { amount: parsed.data.amount });
  return parsed.data;
}

type Adapters = {
  getWallets: () => Promise<{ id: string; name?: string | null }[]>;
  createProposedTransaction: (tx: CreateProposedTransaction) => Promise<unknown>;
};

/**
 * Extract transaction details from a receipt image.
 *
 * - If the model was loaded **without** mmproj (text-only), **never** call multimodal APIs
 *   (they can hang). Use `userContext` text extraction only.
 * - If vision is enabled: try `generateObject` with a timeout, then native `completion`,
 *   then text fallback.
 */
export async function imageExtractionSubAgent(
  model: any,
  imageUri: string,
  userContext: string | undefined,
  logger?: TraceLogger,
): Promise<z.infer<typeof extractionResultSchema> | null> {
  trace(logger, 'extractor', 'start.image', { imageUri, hasContext: Boolean(userContext) });

  if (!isVisionMultimodalEnabled()) {
    trace(logger, 'extractor', 'skip-multimodal-text-only-model', {
      visionEnabled: false,
    });
    if (userContext) {
      trace(logger, 'extractor', 'fallback-to-text', {});
      return textExtractionSubAgent(model, userContext, logger);
    }
    trace(logger, 'extractor', 'no-vision-no-context', {});
    return null;
  }

  const mediaType = mediaTypeForUri(imageUri);
  const contextLine = userContext ? `\nUser context: ${userContext}` : '';

  try {
    trace(logger, 'extractor', 'using-multimodal', {});

    const { object } = await withTimeout(
      generateObject({
        model,
        schema: extractionResultSchema,
        messages: [
          {
            role: 'user' as const,
            content: [
              {
                type: 'text' as const,
                text: `${RECEIPT_EXTRACTION_PROMPT}${contextLine}\n\nAnalyze the receipt image and extract the transaction details.`,
              },
              {
                type: 'file' as const,
                mediaType,
                data: imageUri,
              },
            ],
          },
        ],
        temperature: 0,
      }),
      VISION_GENERATE_OBJECT_MS,
      'multimodal-generateObject',
    );

    trace(logger, 'extractor', 'multimodal.parsed', { amount: object?.amount });
    return object;
  } catch (e) {
    trace(logger, 'extractor', 'multimodal-failed', {
      message: e instanceof Error ? e.message : String(e),
    });

    try {
      const native = await nativeVisionExtract(model, imageUri, userContext, logger);
      if (native) return native;
    } catch (e2) {
      trace(logger, 'extractor', 'native-vision-error', {
        message: e2 instanceof Error ? e2.message : String(e2),
      });
    }

    if (userContext) {
      trace(logger, 'extractor', 'fallback-to-text', {});
      return textExtractionSubAgent(model, userContext, logger);
    }
    return null;
  }
}

export async function runImageFlow(
  model: any,
  imageUri: string,
  userContext: string | undefined,
  adapters: Adapters,
  logger?: TraceLogger,
): Promise<OrchestrationResult> {
  trace(logger, 'orchestrator', 'flow.image', { imageUri, hasContext: Boolean(userContext) });

  const extraction = await imageExtractionSubAgent(model, imageUri, userContext, logger);
  if (!extraction?.amount || extraction.amount <= 0) {
    return { created: false, skipped: true, reason: 'Could not extract a valid amount from image' };
  }

  const type: 'income' | 'expense' = extraction.type === 'income' ? 'income' : 'expense';

  const walletResult = await walletResolutionSubAgent(
    model,
    extraction.wallet_hint,
    extraction.amount,
    type,
    adapters,
    logger,
  );

  const now = new Date().toISOString();
  const proposal: CreateProposedTransaction = {
    sourceType: 'image',
    sourceApp: null,
    sourceText: userContext ?? null,
    sourceImageUri: imageUri,
    notificationTitle: null,
    notificationBody: null,
    notificationReceivedAt: null,
    aiReasoning: `Extracted from receipt image: amount=${extraction.amount}, type=${type}`,
    aiConfidence: 0.6,
    walletId: walletResult.walletId,
    walletHint: extraction.wallet_hint ?? null,
    amount: extraction.amount,
    currency: extraction.currency ?? 'MYR',
    type,
    description: extraction.description ?? 'Receipt',
    merchant: extraction.merchant ?? null,
    categoryId: null,
    categoryHint: extraction.category_hint ?? null,
    transactionDate: now,
    status: 'pending',
  };

  try {
    const created = await adapters.createProposedTransaction(proposal);
    trace(logger, 'creator', 'image.created', { walletId: walletResult.walletId });
    return {
      created: true,
      skipped: false,
      reason: 'Created from receipt image',
      proposalId: (created as any)?.id,
    };
  } catch (e) {
    trace(logger, 'creator', 'image.error', { message: e instanceof Error ? e.message : String(e) });
    return { created: false, skipped: true, reason: 'Failed to create proposal' };
  }
}
