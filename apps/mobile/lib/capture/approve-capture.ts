import type { CaptureDraft, CaptureSource } from '@/lib/capture/capture-stage';
import { locationColumns, type EntryPlaceInput } from '@/lib/capture/entry-place';
import { isMigrated } from '@/lib/store';
import { createTransaction } from '@/lib/supabase/transactions';

/**
 * Approve on a live capture writes the ledger row straight away, never through
 * the Review queue, with the capture's own source and the place saved with it.
 */
export async function approveCapture(
  draft: CaptureDraft & { walletId: string },
  source: CaptureSource,
  place: EntryPlaceInput,
) {
  return createTransaction(
    {
      walletId: draft.walletId,
      amountMinor: draft.amountMinor,
      type: draft.kind,
      categoryId: draft.categoryId,
      merchant: draft.merchant.trim() || null,
      transactionDate: draft.transactionDate,
      ...locationColumns(place, draft.merchant, isMigrated('transaction_place_ids')),
    },
    source,
  );
}
