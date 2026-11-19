import type { AiClient } from '@repo/ai';
import type {
  BudgetSuggestRequest,
  BudgetSuggestResult,
  ChatAnalyzeRequest,
  ChatAnalyzeResult,
  ExtractImageRequest,
  ExtractNotificationRequest,
  ExtractResult,
  ExtractTextRequest,
} from '@repo/types';

import { isE2eBuild } from '@/lib/app-variant';
import {
  budgetFixture,
  chatFixture,
  imageFixture,
  notificationFixture,
  textFixture,
} from './mock-fixtures';

/** What every call answers while `EXPO_PUBLIC_AI_API_URL` is unset and no e2e fixture matches. */
export const AI_UNAVAILABLE_REASON =
  'AI backend is not available yet. Inference will run on a dedicated Go service.';

const TAG = '[AiClient/mock]';

async function simulateNetwork(ms = 250): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function unavailableExtract(endpoint: string, detail?: Record<string, unknown>): ExtractResult {
  console.log(TAG, `POST ${endpoint}`, detail ?? {});
  return { status: 'unavailable', reason: AI_UNAVAILABLE_REASON };
}

export const mockAiClient: AiClient = {
  async extractFromText(req: ExtractTextRequest): Promise<ExtractResult> {
    await simulateNetwork();
    return (
      (isE2eBuild() && textFixture(req)) ||
      unavailableExtract('/v1/extract/text', {
        textLength: req.text.length,
        walletCount: req.wallets.length,
      })
    );
  },

  async extractFromImage(req: ExtractImageRequest): Promise<ExtractResult> {
    await simulateNetwork(400);
    if (isE2eBuild()) return imageFixture(req);
    return unavailableExtract('/v1/extract/image', {
      imageUriTail: req.imageUri.slice(-40),
      hasContext: Boolean(req.userContext),
      walletCount: req.wallets.length,
    });
  },

  async extractFromNotification(req: ExtractNotificationRequest): Promise<ExtractResult> {
    await simulateNetwork();
    return (
      (isE2eBuild() && notificationFixture(req)) ||
      unavailableExtract('/v1/extract/notification', {
        app: req.notification.app,
        notificationId: req.notification.id,
        walletCount: req.wallets.length,
      })
    );
  },

  async analyzeFinances(req: ChatAnalyzeRequest): Promise<ChatAnalyzeResult> {
    await simulateNetwork(300);
    const fixture = isE2eBuild() && chatFixture(req);
    if (fixture) return fixture;
    console.log(TAG, 'POST /v1/chat/analyze', {
      messageLength: req.message.length,
      historyLength: req.history?.length ?? 0,
    });
    return { status: 'unavailable', reason: AI_UNAVAILABLE_REASON };
  },

  async suggestBudget(req: BudgetSuggestRequest): Promise<BudgetSuggestResult> {
    await simulateNetwork(300);
    if (isE2eBuild()) return budgetFixture(req);
    console.log(TAG, 'POST /v1/budget/suggest', { answers: req.answers.length });
    return { status: 'unavailable', reason: AI_UNAVAILABLE_REASON };
  },
};
