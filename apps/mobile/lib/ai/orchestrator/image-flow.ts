import { generateText } from 'ai';
import type { z } from 'zod';
import type { CreateProposedTransaction } from '@repo/types';
import { isVisionMultimodalEnabled } from '@/lib/ai/model-manager';
import { resizeImageToVisionMax, VISION_MAX_EDGE_PX } from '@/lib/storage/image-storage';
import {
  RECEIPT_EXTRACTION_PROMPT,
  RECEIPT_AMOUNT_VISION_PROMPT,
  RECEIPT_DETAILS_VISION_PROMPT,
  extractionResultSchema,
  receiptAmountVisionSchema,
  receiptDetailsVisionSchema,
} from './prompts';
import { textExtractionSubAgent } from './text-flow';
import { walletResolutionSubAgent } from './wallet-resolver';
import type { TraceEvent, TraceLogger, OrchestrationResult } from './types';
import type { LocationSnapshot } from '@/lib/location/location-snapshot';
import { saveProposalLocationSnapshot } from '@/lib/ai/proposal-location-cache';

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

async function runNativeVisionJson<T>(
  model: any,
  imageUri: string,
  prompt: string,
  schema: z.ZodType<T>,
  opts: {
    n_predict: number;
    traceLabel: string;
    logger?: TraceLogger;
    /**
     * Default `false`: pass `stop: ['\\n\\n']` (legacy). Set `true` for JSON that may contain
     * blank lines — otherwise generation stops early and details parse as empty.
     */
    omitStop?: boolean;
  },
): Promise<T | null> {
  const context = model.getContext?.();
  if (!context?.completion) {
    trace(opts.logger, 'extractor', `${opts.traceLabel}.no-context`, {});
    return null;
  }

  trace(opts.logger, 'extractor', `${opts.traceLabel}.completion`, {});

  const completionArgs: Parameters<typeof context.completion>[0] = {
    prompt,
    image_paths: [imageUri],
    n_predict: opts.n_predict,
    temperature: 0,
    ...(!opts.omitStop ? { stop: ['\n\n'] } : {}),
  };

  const response = (await withTimeout(
    context.completion(completionArgs),
    VISION_GENERATE_OBJECT_MS,
    `${opts.traceLabel}-completion`,
  )) as { text?: string } | undefined;

  const text = response?.text ?? '';
  trace(opts.logger, 'extractor', `${opts.traceLabel}.raw`, { textLength: text.length });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }

  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) return null;
  trace(opts.logger, 'extractor', `${opts.traceLabel}.parsed`, {});
  return parsed.data;
}

/**
 * Sub-agent A — native vision: amount, type, currency only (narrow task).
 */
async function nativeVisionAmountSubAgent(
  model: any,
  imageUri: string,
  logger?: TraceLogger,
): Promise<z.infer<typeof receiptAmountVisionSchema> | null> {
  return runNativeVisionJson(model, imageUri, RECEIPT_AMOUNT_VISION_PROMPT, receiptAmountVisionSchema, {
    n_predict: 320,
    traceLabel: 'receipt-amount',
    logger,
    omitStop: false,
  });
}

function detailsPayloadIsThin(d: z.infer<typeof receiptDetailsVisionSchema> | null): boolean {
  if (!d) return true;
  const m = d.merchant?.trim() ?? '';
  const desc = d.description?.trim() ?? '';
  return m.length < 2 && desc.length < 4;
}

/**
 * Sub-agent B — native vision: merchant, description, wallet/category hints (image + user note).
 * Runs **after** amount extraction succeeds; omitStop avoids truncating multi-line JSON.
 */
async function nativeVisionDetailsSubAgent(
  model: any,
  imageUri: string,
  userContext: string | undefined,
  logger: TraceLogger | undefined,
  attempt: 1 | 2,
): Promise<z.infer<typeof receiptDetailsVisionSchema> | null> {
  const prompt = [
    RECEIPT_DETAILS_VISION_PROMPT,
    '',
    `User message (if any — use for wallet_hint when payment method is not on the receipt): ${userContext?.trim() ?? '(none)'}`,
  ].join('\n');

  trace(logger, 'extractor', 'receipt-details.subagent', { attempt, after: 'receipt-amount' });

  return runNativeVisionJson(model, imageUri, prompt, receiptDetailsVisionSchema, {
    n_predict: attempt === 1 ? 512 : 768,
    traceLabel: attempt === 1 ? 'receipt-details' : 'receipt-details-retry',
    logger,
    omitStop: true,
  });
}

/**
 * Second pass when the first details JSON is missing or too thin — still native vision only.
 */
async function runDetailsExtractionAfterAmount(
  model: any,
  imageUri: string,
  userContext: string | undefined,
  logger?: TraceLogger,
): Promise<z.infer<typeof receiptDetailsVisionSchema> | null> {
  let details = await nativeVisionDetailsSubAgent(model, imageUri, userContext, logger, 1);
  if (detailsPayloadIsThin(details)) {
    trace(logger, 'extractor', 'receipt-details.retry-native', {});
    const second = await nativeVisionDetailsSubAgent(model, imageUri, userContext, logger, 2);
    if (!detailsPayloadIsThin(second)) details = second;
  }
  if (details) {
    trace(logger, 'extractor', 'receipt-details.merged-into-proposal', {
      merchantLen: details.merchant?.length ?? 0,
      descriptionLen: details.description?.length ?? 0,
    });
  }
  return details;
}

function mergeNativeVisionExtractions(
  amount: z.infer<typeof receiptAmountVisionSchema>,
  details: z.infer<typeof receiptDetailsVisionSchema> | null,
): z.infer<typeof extractionResultSchema> {
  return {
    amount: amount.amount,
    type: amount.type ?? null,
    currency: amount.currency ?? null,
    merchant: details?.merchant ?? null,
    description: details?.description ?? null,
    wallet_hint: details?.wallet_hint ?? null,
    category_hint: details?.category_hint ?? null,
  };
}

type Adapters = {
  getWallets: () => Promise<{ id: string; name?: string | null }[]>;
  createProposedTransaction: (tx: CreateProposedTransaction) => Promise<unknown>;
};

/**
 * Multimodal receipt extraction using `generateText` + JSON parse — same pattern as the
 * debug vision smoke test. We intentionally avoid `generateObject` here: on
 * `@react-native-ai/llama`, grammar/structured decoding with multimodal input can stall
 * indefinitely (see wallet-resolver.ts for the text-only case).
 */
async function multimodalReceiptExtractWithGenerateText(
  model: any,
  imageUri: string,
  userContext: string | undefined,
  logger?: TraceLogger,
): Promise<z.infer<typeof extractionResultSchema> | null> {
  const mediaType = mediaTypeForUri(imageUri);
  const contextLine = userContext ? `\nUser context: ${userContext}` : '';
  const textPrompt = [
    RECEIPT_EXTRACTION_PROMPT,
    contextLine,
    '',
    'Analyze the receipt image and extract the transaction details.',
    'Respond with ONLY a single JSON object (no markdown, no prose) matching:',
    '{"amount": number|null, "type": "income"|"expense"|null, "currency": string|null, "merchant": string|null, "description": string|null, "wallet_hint": string|null, "category_hint": string|null}',
  ]
    .filter(Boolean)
    .join('\n');

  trace(logger, 'extractor', 'generateText-multimodal.start', {});

  const result = await withTimeout(
    generateText({
      model,
      messages: [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: textPrompt },
            { type: 'file' as const, mediaType, data: imageUri },
          ],
        },
      ],
      temperature: 0,
    }),
    VISION_GENERATE_OBJECT_MS,
    'multimodal-generateText',
  );

  const raw = (result.text ?? '').trim();
  trace(logger, 'extractor', 'generateText-multimodal.raw', { textLength: raw.length });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }

  const parsed = extractionResultSchema.safeParse(parsedJson);
  if (!parsed.success) return null;
  trace(logger, 'extractor', 'generateText-multimodal.parsed', { amount: parsed.data.amount });
  return parsed.data;
}

/**
 * Extract transaction details from a receipt image.
 *
 * - If the model was loaded **without** mmproj (text-only), **never** call multimodal APIs
 *   (they can hang). Use `userContext` text extraction only.
 * - If vision is enabled: **two native vision sub-agents** (amount, then details), then
 *   optional `generateText` multimodal fallback. No `generateObject` for multimodal.
 */
export async function imageExtractionSubAgent(
  model: any,
  imageUri: string,
  userContext: string | undefined,
  logger?: TraceLogger,
): Promise<z.infer<typeof extractionResultSchema> | null> {
  trace(logger, 'extractor', 'start.image', { imageUri, hasContext: Boolean(userContext) });

  const visionUri = await resizeImageToVisionMax(imageUri);
  if (visionUri !== imageUri) {
    trace(logger, 'extractor', 'vision.downscaled', { maxEdge: VISION_MAX_EDGE_PX });
  }

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

  trace(logger, 'extractor', 'using-multimodal', {});

  try {
    trace(logger, 'extractor', 'try-native-two-agent', {});
    const amountOnly = await nativeVisionAmountSubAgent(model, visionUri, logger);
    if (amountOnly && amountOnly.amount != null && amountOnly.amount > 0) {
      let details: z.infer<typeof receiptDetailsVisionSchema> | null = null;
      try {
        details = await runDetailsExtractionAfterAmount(model, visionUri, userContext, logger);
      } catch (e) {
        trace(logger, 'extractor', 'receipt-details-error', {
          message: e instanceof Error ? e.message : String(e),
        });
      }
      const merged = mergeNativeVisionExtractions(amountOnly, details);
      trace(logger, 'extractor', 'native-two-agent.ok', {
        amount: merged.amount,
        hasMerchant: Boolean(merged.merchant?.trim()),
        hasDescription: Boolean(merged.description?.trim()),
      });
      return merged;
    }
  } catch (e) {
    trace(logger, 'extractor', 'native-two-agent-error', {
      message: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    const fromText = await multimodalReceiptExtractWithGenerateText(
      model,
      visionUri,
      userContext,
      logger,
    );
    if (fromText && fromText.amount != null && fromText.amount > 0) {
      return fromText;
    }
  } catch (e) {
    trace(logger, 'extractor', 'generateText-multimodal-failed', {
      message: e instanceof Error ? e.message : String(e),
    });
  }

  if (userContext) {
    trace(logger, 'extractor', 'fallback-to-text', {});
    return textExtractionSubAgent(model, userContext, logger);
  }
  return null;
}

export async function runImageFlow(
  model: any,
  imageUri: string,
  userContext: string | undefined,
  adapters: Adapters,
  locationSnapshot?: LocationSnapshot | null,
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
    { userContext: userContext ?? null },
  );

  const now = new Date().toISOString();
  const merchantTrim = extraction.merchant?.trim() ?? '';
  const descriptionTrim = extraction.description?.trim() ?? '';
  const descriptionForProposal =
    descriptionTrim ||
    (merchantTrim ? `Purchase at ${merchantTrim}` : 'Receipt');

  const aiReasoningParts = [
    `Amount ${extraction.amount} ${extraction.currency ?? 'MYR'} (${type}).`,
    merchantTrim ? `Vendor: ${merchantTrim}.` : null,
    descriptionTrim ? descriptionTrim : null,
  ].filter(Boolean);

  const proposal: CreateProposedTransaction = {
    sourceType: 'image',
    sourceApp: null,
    sourceText: userContext ?? null,
    sourceImageUri: imageUri,
    notificationTitle: null,
    notificationBody: null,
    notificationReceivedAt: null,
    aiReasoning: aiReasoningParts.join(' '),
    aiConfidence: 0.6,
    walletId: walletResult.walletId,
    walletHint: extraction.wallet_hint ?? null,
    amount: extraction.amount,
    currency: extraction.currency ?? 'MYR',
    type,
    description: descriptionForProposal,
    merchant: merchantTrim || null,
    categoryId: null,
    categoryHint: extraction.category_hint ?? null,
    transactionDate: now,
    status: 'pending',
  };

  try {
    const created = await adapters.createProposedTransaction(proposal);
    const proposalId = (created as any)?.id;
    if (proposalId && locationSnapshot) {
      saveProposalLocationSnapshot(proposalId, locationSnapshot);
    }
    trace(logger, 'creator', 'image.created', { walletId: walletResult.walletId });
    return {
      created: true,
      skipped: false,
      reason: 'Created from receipt image',
      proposalId,
    };
  } catch (e) {
    trace(logger, 'creator', 'image.error', { message: e instanceof Error ? e.message : String(e) });
    return { created: false, skipped: true, reason: 'Failed to create proposal' };
  }
}
