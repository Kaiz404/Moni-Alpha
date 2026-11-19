import { AI_CONSENT_REASON } from '@repo/core';
import {
  budgetSuggestResultSchema,
  chatAnalyzeResultSchema,
  extractResultSchema,
  type BudgetSuggestRequest,
  type BudgetSuggestResult,
  type ChatAnalyzeRequest,
  type ChatAnalyzeResult,
  type ExtractImageRequest,
  type ExtractImageWireRequest,
  type ExtractNotificationRequest,
  type ExtractResult,
  type ExtractTextRequest,
} from '@repo/types';
import type { ZodType } from 'zod';

import { postJson, type AiBackend } from './post';

/** Every method answers `ok`, `skipped` or `unavailable` and never throws. */
export interface AiClient {
  extractFromText(req: ExtractTextRequest): Promise<ExtractResult>;
  extractFromImage(req: ExtractImageRequest): Promise<ExtractResult>;
  extractFromNotification(req: ExtractNotificationRequest): Promise<ExtractResult>;
  analyzeFinances(req: ChatAnalyzeRequest): Promise<ChatAnalyzeResult>;
  /** Moni's questions without answers, a monthly amount with them. */
  suggestBudget(req: BudgetSuggestRequest): Promise<BudgetSuggestResult>;
}

/** A receipt the backend can read: a URL it fetches, or the JPEG inline. */
export type ImagePayload = { imageUrl: string } | { imageBase64: string };

export type AiClientOptions = AiBackend & {
  /** Turns the caller's image URI into a payload, or null when it can't be read. */
  encodeImage: (imageUri: string) => Promise<ImagePayload | null>;
  /** Asked before every call. False answers `unavailable: consent` without the network. */
  consent: () => Promise<boolean>;
};

/** Past the backend's 90s write timeout, so a black-holed host can't hold the queue forever. */
const REQUEST_TIMEOUT_MS = 100_000;

type Unavailable = { status: 'unavailable'; reason: string };

async function call<T>(
  backend: AiBackend,
  path: string,
  body: unknown,
  schema: ZodType<T>,
): Promise<T | Unavailable> {
  const reply = await postJson(backend, path, body, REQUEST_TIMEOUT_MS);
  if (!reply.ok) return { status: 'unavailable', reason: reply.reason };
  const parsed = schema.safeParse(reply.body);
  return parsed.success
    ? parsed.data
    : { status: 'unavailable', reason: 'Unexpected AI backend response' };
}

function httpAiClient({ encodeImage, ...backend }: Omit<AiClientOptions, 'consent'>): AiClient {
  return {
    extractFromText: (req) => call(backend, '/v1/extract/text', req, extractResultSchema),
    async extractFromImage(req) {
      const payload = await encodeImage(req.imageUri);
      if (!payload) return { status: 'skipped', reason: 'Could not read the receipt image' };
      const wire: ExtractImageWireRequest = { ...req, ...payload };
      return call(backend, '/v1/extract/image', wire, extractResultSchema);
    },
    extractFromNotification: (req) =>
      call(backend, '/v1/extract/notification', req, extractResultSchema),
    analyzeFinances: (req) => call(backend, '/v1/chat/analyze', req, chatAnalyzeResultSchema),
    suggestBudget: (req) => call(backend, '/v1/budget/suggest', req, budgetSuggestResultSchema),
  };
}

const OFF = { status: 'unavailable', reason: AI_CONSENT_REASON } as const;

/** Every call asks `allowed` first and, while the user has AI off, answers without the network. */
export function withConsent(client: AiClient, allowed: () => Promise<boolean>): AiClient {
  return {
    extractFromText: async (req) => ((await allowed()) ? client.extractFromText(req) : OFF),
    extractFromImage: async (req) => ((await allowed()) ? client.extractFromImage(req) : OFF),
    extractFromNotification: async (req) =>
      (await allowed()) ? client.extractFromNotification(req) : OFF,
    analyzeFinances: async (req) => ((await allowed()) ? client.analyzeFinances(req) : OFF),
    suggestBudget: async (req) => ((await allowed()) ? client.suggestBudget(req) : OFF),
  };
}

/** The client for the Go gateway, gated by the caller's consent check. */
export function createAiClient({ consent, ...options }: AiClientOptions): AiClient {
  return withConsent(httpAiClient(options), consent);
}
