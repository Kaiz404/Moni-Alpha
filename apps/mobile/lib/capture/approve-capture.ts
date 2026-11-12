import type { CaptureDraft, CaptureSource } from '@/lib/capture/capture-stage';
import { locationColumns } from '@/lib/capture/entry-place';
import { createTransaction } from '@/lib/supabase/transactions';
import type { TransactionLocationSnapshot } from '@/lib/transactions/prefetch-location';

/**
 * Approve on a live capture writes the ledger row straight away, never through
 * the Review queue, with the capture's own source and the place saved with it.
 */
export async function approveCapture(
  draft: CaptureDraft & { walletId: string },
  source: CaptureSource,
  location: TransactionLocationSnapshot | null,
) {
  return createTransaction(
    {
      walletId: draft.walletId,
      amountMinor: draft.amountMinor,
      type: draft.kind,
      categoryId: draft.categoryId,
      merchant: draft.merchant.trim() || null,
      transactionDate: draft.transactionDate,
      ...locationColumns(location),
    },
    source,
  );
}
