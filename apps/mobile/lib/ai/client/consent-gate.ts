import { AI_CONSENT_REASON } from '@/lib/ai/consent/model';

import type { AiClient } from './types';

const OFF = { status: 'unavailable', reason: AI_CONSENT_REASON } as const;

/** Every call asks `allowed` first and, when the user has AI off, answers without the network. */
export function gateByConsent(client: AiClient, allowed: () => Promise<boolean>): AiClient {
  return {
    extractFromText: async (req) => ((await allowed()) ? client.extractFromText(req) : OFF),
    extractFromImage: async (req) => ((await allowed()) ? client.extractFromImage(req) : OFF),
    extractFromNotification: async (req) =>
      (await allowed()) ? client.extractFromNotification(req) : OFF,
    analyzeFinances: async (req) => ((await allowed()) ? client.analyzeFinances(req) : OFF),
  };
}
