/**
 * AI backend client types — wire contract for the Go inference service
 * (apps/backend). Prompts and model allocation live in docs/AI.md.
 */

import type { RawNotification } from '@/lib/ai/notification-types';
import type { ChatAnalyzeResult, ChatHistoryMessage } from '@repo/types';
import type { FinanceAssistantToolSnapshot } from '@/lib/ai/snapshot/finance-metrics';

export type { ChatAnalyzeResult, ChatHistoryMessage };

export type AiWalletContext = {
  id: string;
  name: string;
  type?: string | null;
  currency?: string | null;
  /** Optional hint for disambiguating multiple wallets on the same Android app. */
  accountHint?: string | null;
};

export type ExtractedTransaction = {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  currency: string;
  merchant: string | null;
  description: string | null;
  walletHint: string | null;
  categoryHint: string | null;
  /** Resolved source wallet id when the backend is confident; otherwise null. */
  walletId: string | null;
  transferToWalletHint: string | null;
  /** Resolved destination wallet id for transfers; otherwise null. */
  transferToWalletId: string | null;
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

/** Wire shape for POST /v1/extract/image — image data resolved at send time. */
export type ExtractImageWireRequest = ExtractImageRequest & {
  imageBase64?: string;
  imageUrl?: string;
};

export type ExtractNotificationRequest = {
  notification: RawNotification;
  wallets: AiWalletContext[];
  /** When exactly one wallet is linked to the notification app, skip wallet inference. */
  lockedWalletId?: string | null;
};

export type ExtractResult =
  | { status: 'ok'; extraction: ExtractedTransaction }
  | { status: 'skipped'; reason: string }
  | { status: 'unavailable'; reason: string };

export type ChatAnalyzeRequest = {
  message: string;
  snapshot: FinanceAssistantToolSnapshot;
  history?: ChatHistoryMessage[];
};

/**
 * Client interface for the Go AI backend.
 * Swap `mockAiClient` for a real HTTP implementation when the service exists.
 */
export interface AiClient {
  extractFromText(req: ExtractTextRequest): Promise<ExtractResult>;
  extractFromImage(req: ExtractImageRequest): Promise<ExtractResult>;
  extractFromNotification(req: ExtractNotificationRequest): Promise<ExtractResult>;
  analyzeFinances(req: ChatAnalyzeRequest): Promise<ChatAnalyzeResult>;
}
