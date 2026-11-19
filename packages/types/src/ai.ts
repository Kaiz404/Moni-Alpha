import { z } from 'zod';

/**
 * The extraction half of the AI wire contract with the Go gateway (`apps/backend/internal/extract`).
 * The fixtures in `packages/types/fixtures/ai/` hold this file and the Go structs to one shape.
 */

/** One of the user's wallets, sent with every extraction so the backend can name the wallet. */
export const aiWalletContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  /** Tells apart two wallets that share one Android app. */
  accountHint: z.string().nullable().optional(),
});

/** Anchors relative dates; the backend returns no `occurredAt` without it. */
export const extractDateContextSchema = z.object({
  /** Device local time, RFC 3339 with UTC offset. */
  clientNow: z.string().optional(),
  /** IANA zone, e.g. `Asia/Kuala_Lumpur`. */
  timezone: z.string().optional(),
});

export const extractTextRequestSchema = extractDateContextSchema.extend({
  text: z.string().min(1),
  wallets: z.array(aiWalletContextSchema),
});

/** What a caller hands the client: a local or remote image the client encodes at send time. */
export const extractImageRequestSchema = extractDateContextSchema.extend({
  imageUri: z.string(),
  userContext: z.string().optional(),
  wallets: z.array(aiWalletContextSchema),
});

/** POST /v1/extract/image: the request plus the encoded image, inline or as a URL the backend fetches. */
export const extractImageWireRequestSchema = extractImageRequestSchema.extend({
  imageBase64: z.string().optional(),
  imageUrl: z.string().optional(),
});

/** An Android notification as the native listener hands it over, and as the backend reads it. */
export const rawNotificationSchema = z.object({
  id: z.string(),
  /** Android package name from the native listener (same as packageName). */
  app: z.string(),
  /** Canonical routing key: equals `app` from the native listener (CaptureHandoff.kt). */
  packageName: z.string(),
  title: z.string(),
  titleBig: z.string().optional(),
  text: z.string(),
  bigText: z.string().optional(),
  subText: z.string().optional(),
  summaryText: z.string().optional(),
  extraInfoText: z.string().optional(),
  time: z.string(),
  receivedAt: z.string(),
});

export const extractNotificationRequestSchema = z.object({
  notification: rawNotificationSchema,
  wallets: z.array(aiWalletContextSchema),
  /** When exactly one wallet is linked to the notification app, skip wallet inference. */
  lockedWalletId: z.string().nullable().optional(),
});

export const extractedTransactionSchema = z.object({
  amount: z.number(),
  type: z.enum(['income', 'expense', 'transfer']),
  currency: z.string(),
  /** For a receipt, the Shop or note line: "Mr DIY: glue gun, hook, glue stick". */
  merchant: z.string().nullable(),
  /** For a receipt, its item list when the reader has one. */
  description: z.string().nullable(),
  walletHint: z.string().nullable(),
  categoryHint: z.string().nullable(),
  /** Resolved source wallet id when the backend is confident. */
  walletId: z.string().nullable(),
  transferToWalletHint: z.string().nullable(),
  /** Resolved destination wallet id for transfers. */
  transferToWalletId: z.string().nullable(),
  confidence: z.number(),
  reasoning: z.string(),
  /** Local date (YYYY-MM-DD) the input names, text and receipts only. Clamp before use. */
  occurredAt: z.string().nullable().optional(),
  /** How many items a receipt lists; receipts only. Absent when the reader has no count. */
  itemCount: z.number().int().optional(),
});

/** Every extract endpoint answers HTTP 200 with one of these. */
export const extractResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), extraction: extractedTransactionSchema }),
  /** The input isn't a transaction. Final. */
  z.object({ status: z.literal('skipped'), reason: z.string() }),
  /** The model or the network failed. Worth retrying. */
  z.object({ status: z.literal('unavailable'), reason: z.string() }),
]);

/** Any non-2xx body from the gateway: `{ error, details? }`. A refused consent sets `details.reason`. */
export const aiErrorBodySchema = z.object({
  error: z.string(),
  details: z.object({ reason: z.string().optional() }).passthrough().optional(),
});

export type AiWalletContext = z.infer<typeof aiWalletContextSchema>;
export type ExtractDateContext = z.infer<typeof extractDateContextSchema>;
export type ExtractTextRequest = z.infer<typeof extractTextRequestSchema>;
export type ExtractImageRequest = z.infer<typeof extractImageRequestSchema>;
export type ExtractImageWireRequest = z.infer<typeof extractImageWireRequestSchema>;
export type RawNotification = z.infer<typeof rawNotificationSchema>;
export type ExtractNotificationRequest = z.infer<typeof extractNotificationRequestSchema>;
export type ExtractedTransaction = z.infer<typeof extractedTransactionSchema>;
export type ExtractResult = z.infer<typeof extractResultSchema>;
