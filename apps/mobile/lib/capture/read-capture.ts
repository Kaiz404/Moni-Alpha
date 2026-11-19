import { draftFromExtraction, extractDateContext, type ReadContext } from '@repo/core';

import { getAiClient } from '@/lib/ai/client';
import type { CaptureQuote, ReadResult } from '@/lib/capture/capture-stage';
import { AUTO_PLACE } from '@/lib/capture/entry-place';

/** Sends what was heard or scanned to the reader. Nothing is written anywhere. */
export async function readCapture(
  quote: CaptureQuote,
  context: ReadContext,
): Promise<ReadResult> {
  const capturedAt = new Date();
  const wallets = context.wallets.map((wallet) => ({
    id: wallet.id,
    name: wallet.name,
    type: wallet.type,
    currency: wallet.currency,
  }));
  const client = getAiClient(quote.source === 'voice' ? 'add' : 'receipts');
  try {
    const result =
      quote.source === 'voice'
        ? await client.extractFromText({
            text: quote.text,
            wallets,
            ...extractDateContext(capturedAt),
          })
        : await client.extractFromImage({
            imageUri: quote.imageUri,
            wallets,
            ...extractDateContext(capturedAt),
          });
    const read = draftFromExtraction(result, context, capturedAt);
    return read.status === 'ok'
      ? { status: 'ok', draft: { ...read.draft, place: AUTO_PLACE } }
      : read;
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
