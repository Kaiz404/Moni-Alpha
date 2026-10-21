import type { CaptureDraft, CaptureSource } from '@/lib/capture/capture-stage';
import { createTransaction } from '@/lib/supabase/transactions';

/**
 * Approve on a live capture writes the ledger row straight away, never through
 * the Review queue, with the capture's own source.
 */
export async function approveCapture(
  draft: CaptureDraft & { walletId: string },
  source: CaptureSource,
) {
  return createTransaction(
    {
      walletId: draft.walletId,
      amountMinor: draft.amountMinor,
      type: draft.kind,
      categoryId: draft.categoryId,
      merchant: draft.merchant.trim() || null,
      transactionDate: draft.transactionDate,
    },
    source,
  );
}
