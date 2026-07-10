/**
 * AI backend client entry point.
 *
 * Until EXPO_PUBLIC_AI_API_URL points at a live Go service, all calls go
 * through the mock client (features no-op with a clear unavailable reason).
 */
import { AI_BACKEND_CONFIGURED } from './config';
import { httpAiClient } from './http-client';
import { mockAiClient } from './mock';
import type { AiClient } from './types';

export type {
  AiClient,
  AiWalletContext,
  ExtractedTransaction,
  ExtractImageRequest,
  ExtractNotificationRequest,
  ExtractResult,
  ExtractTextRequest,
  FinanceAssistantApiResult,
  FinanceAssistantRequest,
} from './types';

export {
  AI_API_BASE_URL,
  AI_BACKEND_CONFIGURED,
  AI_UNAVAILABLE_REASON,
} from './config';

/** Active client — mock until the Go backend URL is configured. */
export function getAiClient(): AiClient {
  return AI_BACKEND_CONFIGURED ? httpAiClient : mockAiClient;
}
