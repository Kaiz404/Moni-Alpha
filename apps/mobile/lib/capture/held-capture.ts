import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import { enqueue, getAll, remove } from '@/lib/ai/processing-queue';
import type { CaptureQuote } from '@/lib/capture/capture-stage';
import { saveImageLocally } from '@/lib/receipts/images';

/**
 * A live capture the reader could not reach, written down the moment it failed so a kill on the
 * failed page cannot lose it. The processor leaves it alone while the page decides. The scan moves
 * out of the cache first, because the cache can be purged before Moni is back.
 */
export async function holdCapture(quote: CaptureQuote): Promise<string> {
  const base = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'held' as const,
    locationSnapshot: null,
  };
  enqueue(
    quote.source === 'voice'
      ? { ...base, type: 'text', text: quote.text }
      : { ...base, type: 'image', imageUri: await saveImageLocally(quote.imageUri) },
  );
  return base.id;
}

/** The read went through after all, or the user typed it instead: nothing is left to keep. */
export function dropHeldCapture(id: string): void {
  const item = getAll().find((entry) => entry.id === id);
  remove(id);
  if (item?.type !== 'image') return;
  try {
    new File(item.imageUri).delete();
  } catch {
    // An orphaned copy in the receipts folder costs nothing but a little disk.
  }
}
