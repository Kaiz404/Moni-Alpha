/**
 * Backwards-compatible receipt aliases for the user-initiated proposal
 * presentation channel. Other capture sources (Chat and narration) use the
 * source-neutral helpers in `lib/proposals` directly.
 */
import {
  beginImmediateProposalReview,
  clearImmediateProposalReview,
  getImmediateProposalReview,
  useImmediateProposalReview,
} from '@/lib/proposals/immediate-review';
import { waitForProposal, type ProposalWaitResult } from '@/lib/proposals/proposal-wait';

const RECEIPT_COPY = {
  title: 'Reading your receipt…',
  detail: 'Moni will show every detail before saving anything.',
  icon: 'receipt',
} as const;

export type ReceiptProposalWaitResult = ProposalWaitResult;

export function startFabReceiptProcessing(proposalId: string) {
  beginImmediateProposalReview(proposalId, RECEIPT_COPY);
}

export function stopFabReceiptProcessing() {
  clearImmediateProposalReview();
}

export function getFabReceiptProcessingProposalId(): string | null {
  return getImmediateProposalReview().proposalId;
}

export function isFabReceiptProcessingActive(): boolean {
  return getImmediateProposalReview().active;
}

/** React hook retained for the root processing overlay. */
export function useFabReceiptProcessing() {
  return useImmediateProposalReview();
}

/** Kept for existing receipt callers; the generic helper works for every queue item. */
export function waitForReceiptProposal(proposalId: string, timeoutMs = 120_000) {
  return waitForProposal(proposalId, timeoutMs);
}
