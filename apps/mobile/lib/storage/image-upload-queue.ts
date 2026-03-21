import { createMMKV } from 'react-native-mmkv';
import { uploadReceiptImage } from './image-storage';
import { updateProposalImageUri } from '@/lib/supabase/proposed-transactions';

const storage = createMMKV({ id: 'moni-image-uploads' });
const QUEUE_KEY = 'pending_image_uploads';

type PendingUpload = {
  proposalId: string;
  localUri: string;
  userId: string;
};

function readQueue(): PendingUpload[] {
  try {
    const raw = storage.getString(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: PendingUpload[]) {
  storage.set(QUEUE_KEY, JSON.stringify(items));
}

export function enqueueImageUpload(item: PendingUpload) {
  const queue = readQueue();
  queue.push(item);
  writeQueue(queue);
}

export function getPendingUploadCount(): number {
  return readQueue().length;
}

/**
 * Attempt to upload all pending receipt images to Supabase Storage.
 * Successfully uploaded items are removed from the queue and their
 * proposed_transaction record is updated with the remote URL.
 *
 * Safe to call frequently -- skips silently if queue is empty.
 */
export async function drainImageUploadQueue(): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  const remaining: PendingUpload[] = [];
  let uploaded = 0;

  for (const item of queue) {
    try {
      const remoteUrl = await uploadReceiptImage(
        item.localUri,
        item.userId,
        item.proposalId,
      );
      if (remoteUrl) {
        await updateProposalImageUri(item.proposalId, remoteUrl);
        uploaded++;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  return uploaded;
}
