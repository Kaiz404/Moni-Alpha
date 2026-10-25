/**
 * Mock AI client, used whenever EXPO_PUBLIC_AI_API_URL is empty. It reports unavailable,
 * except in the Moni E2E build, where inputs listed in `mock-fixtures.ts` get fixed answers.
 */
import { isE2eBuild } from '@/lib/app-variant';
import { AI_UNAVAILABLE_REASON } from './config';
import { chatFixture, imageFixture, notificationFixture, textFixture } from './mock-fixtures';
import type {
  AiClient,
  ChatAnalyzeRequest,
  ChatAnalyzeResult,
  ExtractImageRequest,
  ExtractNotificationRequest,
  ExtractResult,
  ExtractTextRequest,
} from './types';

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
};
