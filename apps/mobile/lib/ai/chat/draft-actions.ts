import type { ProposedTransaction } from '@repo/types';

import {
  approveProposedTransaction,
  laterProposedTransaction,
  rejectProposedTransaction,
} from '@/lib/supabase/proposed-transactions';

/**
 * Approve, Not mine, and Later for a chat draft. R1's review-actions.ts owns
 * the same three for the Review deck; this file goes once that lands.
 */
export type DraftEdits = {
  merchant: string | null;
  amountMinor: number | null;
  categoryId: string | null;
  walletId: string | null;
};

export type ApproveResult = { status: 'done' } | { status: 'needsInput'; field: 'wallet' | 'amount' };

/** How long Later hides a draft from Review. */
export const LATER_MS = 3 * 60 * 60 * 1000;

export async function approveDraft(
  proposal: ProposedTransaction,
  edits: DraftEdits,
): Promise<ApproveResult> {
  if (!edits.walletId) return { status: 'needsInput', field: 'wallet' };
  if (!edits.amountMinor) return { status: 'needsInput', field: 'amount' };
  await approveProposedTransaction(
    {
      ...proposal,
      merchant: edits.merchant,
      amountMinor: edits.amountMinor as ProposedTransaction['amountMinor'],
      categoryId: edits.categoryId,
      walletId: edits.walletId,
    },
    { walletId: edits.walletId },
  );
  return { status: 'done' };
}

export function notMineDraft(proposalId: string): Promise<void> {
  return rejectProposedTransaction(proposalId);
}

export function laterDraft(proposalId: string, now: Date = new Date()): void {
  laterProposedTransaction(proposalId, new Date(now.getTime() + LATER_MS));
}
