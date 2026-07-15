import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';

import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import { enqueue, type ProcessingQueueItem } from '@/lib/ai/processing-queue';
import { captureLocationSnapshot } from '@/lib/location/location-snapshot';
import { saveImageLocally } from '@/lib/receipts/images';
import { enqueueImageUpload } from '@/lib/receipts/upload-queue';
import { getUserId } from '@/lib/supabase/client';
import { ReceiptCamera } from '@/components/receipt/receipt-camera';

const TAG = '[Moni/Scan]';

/**
 * Queues a processed receipt image through the same extraction pipeline as the Chat tab.
 * Only called after a successful ML Kit scan + normalize on Android.
 */
async function queueReceiptImage(uri: string) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const [locationSnapshot, localUri] = await Promise.all([
    captureLocationSnapshot(),
    saveImageLocally(uri),
  ]);

  const queueItem: ProcessingQueueItem = {
    id,
    type: 'image',
    imageUri: localUri,
    createdAt,
    status: 'pending',
    locationSnapshot,
  };
  enqueue(queueItem);

  try {
    const userId = await getUserId();
    if (userId) enqueueImageUpload({ proposalId: id, localUri, userId });
  } catch {
    // non-critical — upload queue will retry on its own
  }

  startBackgroundProcessor().catch((e) => console.warn(TAG, 'Background processor start failed:', e));
}

export default function ScanReceiptScreen() {
  return (
    <ReceiptCamera
      variant="fullscreen"
      onCancel={() => router.back()}
      onComplete={async (uri) => {
        try {
          await queueReceiptImage(uri);
        } catch (e) {
          console.warn(TAG, 'Failed to queue receipt:', e);
        }
        router.back();
      }}
    />
  );
}
