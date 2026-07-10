/**
 * AI backend client types — contract for the future Go inference service.
 * See BACKEND_AI.md for prompts and orchestration notes.
 */

import type { RawNotification } from '@/lib/ai/notification-types';
import type { MoniFinanceAssistantV1 } from '@repo/types';
import type { FinanceAssistantToolSnapshot } from '@/lib/ai/insights/finance-assistant-metrics';

export type AiWalletContext = {
  id: string;
  name: string;
  type?: string | null;
  currency?: string | null;
};

export type ExtractedTransaction = {
  amount: number;
  type: 'income' | 'expense';
  currency: string;
  merchant: string | null;
  description: string | null;
  walletHint: string | null;
  categoryHint: string | null;
  /** Resolved wallet id when the backend is confident; otherwise null. */
  walletId: string | null;
  confidence: number;
  reasoning: string;
};

export type ExtractTextRequest = {
  text: string;
  wallets: AiWalletContext[];
};

export type ExtractImageRequest = {
  imageUri: string;
  userContext?: string;
  wallets: AiWalletContext[];
};

export type ExtractNotificationRequest = {
  notification: RawNotification;
  wallets: AiWalletContext[];
};

export type ExtractResult =
  | { status: 'ok'; extraction: ExtractedTransaction }
  | { status: 'skipped'; reason: string }
  | { status: 'unavailable'; reason: string };

export type FinanceAssistantRequest = {
  snapshot: FinanceAssistantToolSnapshot;
};

export type FinanceAssistantApiResult =
  | { status: 'ok'; result: MoniFinanceAssistantV1; modelId: string }
  | { status: 'unavailable'; reason: string };

/**
 * Client interface for the Go AI backend.
 * Swap `mockAiClient` for a real HTTP implementation when the service exists.
 */
export interface AiClient {
  extractFromText(req: ExtractTextRequest): Promise<ExtractResult>;
  extractFromImage(req: ExtractImageRequest): Promise<ExtractResult>;
  extractFromNotification(req: ExtractNotificationRequest): Promise<ExtractResult>;
  generateFinanceAssistant(
    req: FinanceAssistantRequest,
  ): Promise<FinanceAssistantApiResult>;
}
