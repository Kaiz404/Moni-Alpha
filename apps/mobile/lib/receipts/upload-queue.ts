import { imageUploadMMKV } from '@/lib/mmkv/image-uploads';
import { uploadReceiptImage } from '@/lib/receipts/images';
import { getUserId } from '@/lib/supabase/client';
import { updateProposalImageUri } from '@/lib/supabase/proposed-transactions';

const QUEUE_KEY = 'pending_image_uploads';

type PendingUpload = {
  proposalId: string;
  localUri: string;
  userId: string;
};

function readQueue(): PendingUpload[] {
  try {
    const raw = imageUploadMMKV.getString(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: PendingUpload[]) {
  imageUploadMMKV.set(QUEUE_KEY, JSON.stringify(items));
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

  // RootLayout can run before Supabase restores the MMKV-backed session. Do
  // not make an unauthenticated Storage request: it is guaranteed to fail RLS
  // and the item remains safely queued for the next foreground transition.
  const authenticatedUserID = await getUserId();
  if (!authenticatedUserID) return 0;

  const remaining: PendingUpload[] = [];
  let uploaded = 0;

  for (const item of queue) {
    if (item.userId !== authenticatedUserID) {
      remaining.push(item);
      continue;
    }
    try {
      const remoteUrl = await uploadReceiptImage(item.localUri, item.userId, item.proposalId);
      if (remoteUrl) {
        const linked = await updateProposalImageUri(item.proposalId, remoteUrl);
        if (linked) {
          uploaded++;
        } else {
          remaining.push(item);
        }
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
