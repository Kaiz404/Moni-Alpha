import type { MinorAmount } from '@repo/types';

/** How a live capture reached Moni: its `metadata.source` once approved. */
export type CaptureSource = 'voice' | 'camera';

/** What the check page edits before Approve. Nothing is in the ledger yet. */
export type CaptureDraft = {
  kind: 'expense' | 'income';
  merchant: string;
  amountMinor: MinorAmount;
  categoryId: string | null;
  walletId: string | null;
  /** ISO time the purchase happened. */
  transactionDate: string;
  /** The one line that says why Moni filled the fields as it did. */
  evidence: string;
};

/** What the user gave Moni: the words heard, or the scanned image. */
export type CaptureQuote =
  | { source: 'voice'; text: string }
  | { source: 'camera'; imageUri: string };

/** `unreadable`: Moni found no amount. `unavailable`: the reader could not be reached. */
export type ReadFailure = 'unreadable' | 'unavailable';

export type ReadResult =
  | { status: 'ok'; draft: CaptureDraft }
  | { status: ReadFailure; reason: string };

/**
 * The live capture pages (V2A-CaptureScan, V2A-CaptureSayHeard): `capture` is
 * the camera or the microphone, then Moni reads it, the user checks the
 * result, and Approve adds it straight to the ledger.
 */
export type CaptureStage =
  | { name: 'capture' }
  | { name: 'reading'; quote: CaptureQuote }
  | { name: 'result'; quote: CaptureQuote; draft: CaptureDraft }
  | { name: 'approved'; draft: CaptureDraft }
  | {
      name: 'failed';
      quote: CaptureQuote;
      failure: ReadFailure;
      reason: string;
    };

export type CaptureEvent =
  | { type: 'captured'; quote: CaptureQuote }
  | { type: 'read'; result: ReadResult }
  | { type: 'edit'; patch: Partial<CaptureDraft> }
  | { type: 'approved' }
  | { type: 'retry' };

export const START: CaptureStage = { name: 'capture' };

/** One transition per event; an event that does not fit the stage leaves it unchanged. */
export function captureStage(
  stage: CaptureStage,
  event: CaptureEvent,
): CaptureStage {
  switch (event.type) {
    case 'captured':
      return stage.name === 'capture'
        ? { name: 'reading', quote: event.quote }
        : stage;
    case 'read':
      if (stage.name !== 'reading') return stage;
      return event.result.status === 'ok'
        ? { name: 'result', quote: stage.quote, draft: event.result.draft }
        : {
            name: 'failed',
            quote: stage.quote,
            failure: event.result.status,
            reason: event.result.reason,
          };
    case 'edit':
      return stage.name === 'result'
        ? { ...stage, draft: { ...stage.draft, ...event.patch } }
        : stage;
    case 'approved':
      return stage.name === 'result'
        ? { name: 'approved', draft: stage.draft }
        : stage;
    case 'retry':
      return stage.name === 'result' ||
        stage.name === 'failed' ||
        stage.name === 'approved'
        ? START
        : stage;
  }
}
