/**
 * AI backend client entry point.
 *
 * Until EXPO_PUBLIC_AI_API_URL points at a live Go service, all calls go
 * through the mock client (features no-op with a clear unavailable reason).
 */
import type { AiUse } from '@repo/types';

import { AI_BACKEND_CONFIGURED } from './config';
import { gateByConsent } from './consent-gate';
import { httpAiClient } from './http-client';
import { mockAiClient } from './mock';
import type { AiClient } from './types';

export type {
  AiClient,
  AiWalletContext,
  ChatAnalyzeRequest,
  ChatAnalyzeResult,
  ExtractedTransaction,
  ExtractImageRequest,
  ExtractNotificationRequest,
  ExtractResult,
  ExtractTextRequest,
} from './types';

export { AI_API_BASE_URL, AI_BACKEND_CONFIGURED, AI_UNAVAILABLE_REASON } from './config';

/**
 * The client for one use of Moni's AI: mock until the Go backend URL is configured, and answering
 * `unavailable: consent` without the network while the user has that use off.
 */
export function getAiClient(use: AiUse): AiClient {
  return gateByConsent(AI_BACKEND_CONFIGURED ? httpAiClient : mockAiClient, async () => {
    // Loaded on first use, so importing this module does not start the store.
    const { aiUseAllowedNow } = await import('@/lib/ai/consent/state');
    return aiUseAllowedNow(use);
  });
}
