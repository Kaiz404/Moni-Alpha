/**
 * Mock AI client — stands in for the future Go inference backend.
 * Simulates network latency and always reports unavailable until a real
 * HTTP client is wired (see http-client.ts).
 */
import { AI_UNAVAILABLE_REASON } from './config';
import type {
  AiClient,
  ExtractImageRequest,
  ExtractNotificationRequest,
  ExtractResult,
  ExtractTextRequest,
  FinanceAssistantApiResult,
  FinanceAssistantRequest,
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
    return unavailableExtract('/v1/extract/text', {
      textLength: req.text.length,
      walletCount: req.wallets.length,
    });
  },

  async extractFromImage(req: ExtractImageRequest): Promise<ExtractResult> {
    await simulateNetwork(400);
    return unavailableExtract('/v1/extract/image', {
      imageUriTail: req.imageUri.slice(-40),
      hasContext: Boolean(req.userContext),
      walletCount: req.wallets.length,
    });
  },

  async extractFromNotification(
    req: ExtractNotificationRequest,
  ): Promise<ExtractResult> {
    await simulateNetwork();
    return unavailableExtract('/v1/extract/notification', {
      app: req.notification.app,
      notificationId: req.notification.id,
      walletCount: req.wallets.length,
    });
  },

  async generateFinanceAssistant(
    req: FinanceAssistantRequest,
  ): Promise<FinanceAssistantApiResult> {
    await simulateNetwork(300);
    console.log(TAG, 'POST /v1/insights/finance-assistant', {
      monthKey: req.snapshot.calendarMonth?.currentMonthKey,
    });
    return { status: 'unavailable', reason: AI_UNAVAILABLE_REASON };
  },
};
