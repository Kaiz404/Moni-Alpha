import type { ProposedTransaction } from '@repo/types';

import { imageUploadMMKV } from '@/lib/mmkv/image-uploads';
import { saveImageLocally, uploadReceiptImage } from '@/lib/receipts/images';
import { getUserId } from '@/lib/supabase/client';
import { updateProposalImageUri } from '@/lib/supabase/proposed-transactions';
import { setTransactionReceipt } from '@/lib/supabase/transactions';

const QUEUE_KEY = 'pending_image_uploads';

/** A receipt photo waiting to upload, and the row its URL goes on once it does. */
type PendingUpload = {
  target: 'proposal' | 'transaction';
  id: string;
  localUri: string;
  userId: string;
};

/** Before transactions could own an upload, every item named its proposal as `proposalId`. */
type StoredUpload = PendingUpload | { proposalId: string; localUri: string; userId: string };

function readQueue(): PendingUpload[] {
  try {
    const raw = imageUploadMMKV.getString(QUEUE_KEY);
    const stored: StoredUpload[] = raw ? JSON.parse(raw) : [];
    return stored.map((item) =>
      'proposalId' in item
        ? { target: 'proposal', id: item.proposalId, localUri: item.localUri, userId: item.userId }
        : item,
    );
  } catch {
    return [];
  }
}

function writeQueue(items: PendingUpload[]) {
  imageUploadMMKV.set(QUEUE_KEY, JSON.stringify(items));
}

export function enqueueImageUpload(item: PendingUpload) {
  writeQueue([...readQueue(), item]);
}

export function getPendingUploadCount(): number {
  return readQueue().length;
}

/**
 * Keeps a capture's receipt photo on the transaction Approve wrote: an uploaded URL is linked
 * now, and a photo still waiting to upload is linked to the transaction when it lands.
 */
export function keepProposalReceipt(
  proposal: Pick<ProposedTransaction, 'id' | 'sourceImageUri'>,
  transactionId: string,
): void {
  if (proposal.sourceImageUri?.startsWith('http')) {
    setTransactionReceipt(transactionId, proposal.sourceImageUri);
    return;
  }
  writeQueue(
    readQueue().map((item) =>
      item.target === 'proposal' && item.id === proposal.id
        ? { ...item, target: 'transaction', id: transactionId }
        : item,
    ),
  );
  void drainImageUploadQueue().catch(() => {});
}

/** Keeps a scanned receipt with the transaction a live capture just wrote. */
export async function keepScannedReceipt(imageUri: string, transactionId: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  enqueueImageUpload({
    target: 'transaction',
    id: transactionId,
    localUri: await saveImageLocally(imageUri),
    userId,
  });
  await drainImageUploadQueue();
}

async function link(item: PendingUpload, remoteUrl: string): Promise<boolean> {
  if (item.target === 'proposal') return updateProposalImageUri(item.id, remoteUrl);
  setTransactionReceipt(item.id, remoteUrl);
  return true;
}

/**
 * Attempt to upload all pending receipt images to Supabase Storage.
 * Successfully uploaded items are removed from the queue and their
 * proposal or transaction is updated with the remote URL.
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

  const done = new Set<PendingUpload>();
  for (const item of queue) {
    if (item.userId !== authenticatedUserID) continue;
    try {
      const remoteUrl = await uploadReceiptImage(item.localUri, item.userId, item.id);
      if (remoteUrl && (await link(item, remoteUrl))) done.add(item);
    } catch {
      // Stays queued for the next foreground.
    }
  }

  // Items queued or retargeted while this drain ran are kept as they now stand.
  const finished = new Set([...done].map((item) => `${item.localUri}|${item.target}|${item.id}`));
  writeQueue(
    readQueue().filter((item) => !finished.has(`${item.localUri}|${item.target}|${item.id}`)),
  );
  return done.size;
}
