import type { ProposedTransaction } from '@repo/types';

import { imageUploadMMKV } from '@/lib/mmkv/image-uploads';
import { saveImageLocally, uploadReceiptImage } from '@/lib/receipts/images';
import { getUserId } from '@/lib/supabase/client';
import { updateProposalImageUri } from '@/lib/supabase/proposed-transactions';
import { setTransactionReceipt } from '@/lib/supabase/transactions';

const QUEUE_KEY = 'pending_image_uploads';

type PendingUpload = {
  target: 'proposal' | 'transaction';
  id: string;
  localUri: string;
  userId: string;
};

/** Queued by builds from before an upload could target a transaction. */
type LegacyProposalUpload = { proposalId: string; localUri: string; userId: string };

function fromLegacy(item: LegacyProposalUpload): PendingUpload {
  return { target: 'proposal', id: item.proposalId, localUri: item.localUri, userId: item.userId };
}

const uploadKey = (item: PendingUpload) => `${item.localUri}|${item.target}|${item.id}`;

function readQueue(): PendingUpload[] {
  try {
    const raw = imageUploadMMKV.getString(QUEUE_KEY);
    const stored: (PendingUpload | LegacyProposalUpload)[] = raw ? JSON.parse(raw) : [];
    return stored.map((item) => ('proposalId' in item ? fromLegacy(item) : item));
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

/** Moves a capture's receipt photo, uploaded or still queued, onto the transaction Approve wrote. */
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
    } catch {}
  }
  removeUploaded(done);
  return done.size;
}

/** Re-reads the queue, so items queued or retargeted during a drain survive it. */
function removeUploaded(done: ReadonlySet<PendingUpload>): void {
  const uploaded = new Set([...done].map(uploadKey));
  writeQueue(readQueue().filter((item) => !uploaded.has(uploadKey(item))));
}
