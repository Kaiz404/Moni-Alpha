import { createAiClient, withConsent, type AiClient } from '@repo/ai';
import type { AiUse } from '@repo/types';

import { AI_BACKEND_CONFIGURED, aiBackend } from './config';
import { buildImagePayload } from './image-payload';
import { mockAiClient } from './mock';

/**
 * The client for one use of Moni's AI: the Go gateway once `EXPO_PUBLIC_AI_API_URL` is set, the
 * mock until then, and either answers `unavailable: consent` without the network while the user
 * has that use off.
 */
export function getAiClient(use: AiUse): AiClient {
  const consent = async () => {
    // Loaded on first use, so importing this module does not start the store.
    const { aiUseAllowedNow } = await import('@/lib/ai/consent/state');
    return aiUseAllowedNow(use);
  };
  return AI_BACKEND_CONFIGURED
    ? createAiClient({ ...aiBackend, encodeImage: buildImagePayload, consent })
    : withConsent(mockAiClient, consent);
}
