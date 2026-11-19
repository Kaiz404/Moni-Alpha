import type { ProposedTransaction, TransactionType } from '@repo/types';

import type { DuplicateMatch } from '@/lib/ai/duplicates';
import {
  editedProposal,
  planNotATransfer,
  planReopen,
  planSimilarRule,
  type ReviewChanges,
  type ReviewEdits as EditsOnCapture,
  type StoredRow,
} from '@repo/core';
import { canPairInto, pairCapture, toAbsorbedCapture, undoPairing } from '@/lib/proposals/pairing';
import { emitProposedTransactionsChanged } from '@/lib/proposals/proposed-transactions-events';
import { keepProposalReceipt } from '@/lib/receipts/upload-queue';
import { proposedTransactions$ } from '@/lib/store';
import { hasRow } from '@/lib/store/helpers';
import { commit } from '@/lib/store/writes';
import {
  applyReview,
  findProposalDuplicate,
  isOpenProposal,
  markCaptures,
  planDecision,
  reviewContext,
  reviewView,
  type RejectedProposal,
} from '@/lib/supabase/proposed-transactions';
import { retypeFields } from '@/lib/transactions/type-change';

/**
 * What the user changed on a capture before deciding. A field left undefined keeps the
 * proposal's value; `walletId: null` means no wallet is picked yet.
 */
export type ReviewEdits = EditsOnCapture & {
  /** "Don't ask about similar": Approve also adds an auto-add rule for this app and merchant. */
  similar?: boolean;
};

/** The proposed_transactions row as stored, kept so Undo can put it back. */
export type ProposalRowSnapshot = StoredRow<'proposed_transactions'>;

/** Everything Undo needs. Plain JSON, so a notification can carry it. */
export type ReviewOutcome =
  | {
      action: 'approve';
      proposal: ProposedTransaction;
      row: ProposalRowSnapshot;
      transactionId: string;
      /** The auto-add rule "Don't ask about similar" saved, and whether this Approve created it. */
      rule: ReviewChanges['rule'];
    }
  | { action: 'notMine'; proposal: ProposedTransaction; row: ProposalRowSnapshot }
  | { action: 'pair'; proposal: ProposedTransaction };

export type ReviewField = 'wallet' | 'destination';

export type ReviewResult =
  | { status: 'done'; outcome: ReviewOutcome }
  | { status: 'needsInput'; field: ReviewField }
  | { status: 'error'; message: string };

/** The row as it stands, or null once it has a decision: the guard against deciding twice. */
function openRow(id: string): ProposalRowSnapshot | null {
  if (!isOpenProposal(id)) return null;
  return { ...(proposedTransactions$[id].peek() as ProposalRowSnapshot) };
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function reviewType(
  proposal: ProposedTransaction,
  edits: ReviewEdits,
): TransactionType | null {
  return edits.type ?? proposal.type;
}

/** Going back to the type Moni read brings back the category it read with it. */
export function retypeEdits(proposal: ProposedTransaction, next: TransactionType): ReviewEdits {
  return next === proposal.type ? { type: undefined, categoryId: undefined } : retypeFields(next);
}

/** Writes the ledger row. Nothing is written until every required field is present. */
export async function approve(
  proposal: ProposedTransaction,
  edits: ReviewEdits = {},
): Promise<ReviewResult> {
  const { similar, ...changes } = edits;
  const row = openRow(proposal.id);
  const plan = await planDecision(proposal, { kind: 'approve', edits: changes, similar });
  if (plan.kind === 'needsInput') return { status: 'needsInput', field: plan.field };
  if (plan.kind === 'error') return { status: 'error', message: plan.message };
  if (!row) return { status: 'error', message: 'This capture was already reviewed.' };
  try {
    const { transactionId, rule } = applyReview(proposal.id, plan);
    const next = editedProposal(proposal, changes);
    keepProposalReceipt(next, transactionId!);
    return {
      status: 'done',
      outcome: { action: 'approve', proposal: next, row, transactionId: transactionId!, rule },
    };
  } catch (error) {
    return { status: 'error', message: messageOf(error, "Couldn't save. Try again.") };
  }
}

export type ApprovedOutcome = Extract<ReviewOutcome, { action: 'approve' }>;

/** "Don't ask about similar" after Approve, from the Approved notification. */
export async function dontAskAboutSimilar(outcome: ApprovedOutcome): Promise<ApprovedOutcome> {
  if (outcome.rule) return outcome;
  try {
    const rule = commit(planSimilarRule(outcome.proposal, {}, reviewView(), await reviewContext()));
    return { ...outcome, rule };
  } catch (error) {
    console.warn('[review] auto-add rule not saved:', messageOf(error, 'unknown'));
    return outcome;
  }
}

export async function notMine(proposal: ProposedTransaction): Promise<ReviewResult> {
  const row = openRow(proposal.id);
  if (!row) return { status: 'error', message: 'This capture was already reviewed.' };
  try {
    applyReview(proposal.id, await planDecision(proposal, { kind: 'notMine' }));
    return { status: 'done', outcome: { action: 'notMine', proposal, row } };
  } catch (error) {
    return { status: 'error', message: messageOf(error, "Couldn't save. Try again.") };
  }
}

/** The card's Same payment or It's a transfer: this capture counts once with what it matched. */
export async function samePayment(
  proposal: ProposedTransaction,
  edits: ReviewEdits,
  match: DuplicateMatch,
): Promise<ReviewResult> {
  if (!canPairInto(match) || !openRow(proposal.id)) {
    return { status: 'error', message: 'This capture was already reviewed.' };
  }
  try {
    await pairCapture(toAbsorbedCapture(editedProposal(proposal, edits)), match);
    return { status: 'done', outcome: { action: 'pair', proposal } };
  } catch (error) {
    return { status: 'error', message: messageOf(error, "Couldn't save. Try again.") };
  }
}

/**
 * The card's way out when Moni read an alert as moving the user's own money and it wasn't: the
 * capture stays in Review with the merchant the alert named.
 */
export function notATransfer(proposal: ProposedTransaction): void {
  commit(planNotATransfer(proposal, { now: new Date().toISOString() }));
  emitProposedTransactionsChanged();
}

function reopen(row: ProposalRowSnapshot, changes: Pick<ReviewChanges, 'transactionId' | 'rule'>): void {
  const plan = planReopen(row, changes, hasRow(proposedTransactions$, row.id), { now: new Date().toISOString() });
  markCaptures(commit(plan).captureMarks);
  emitProposedTransactionsChanged();
}

export function moveBackToReview(proposal: RejectedProposal): void {
  const row = proposedTransactions$[proposal.id].peek() as ProposalRowSnapshot | undefined;
  if (row) reopen(row, { transactionId: null, rule: null });
}

/** Puts the capture back in review. Every write sets values, so running it twice converges. */
export async function undo(outcome: ReviewOutcome): Promise<void> {
  switch (outcome.action) {
    case 'approve':
      reopen(outcome.row, { transactionId: outcome.transactionId, rule: outcome.rule });
      return;
    case 'notMine':
      reopen(outcome.row, { transactionId: null, rule: null });
      return;
    case 'pair':
      await undoPairing(outcome.proposal.id);
      return;
  }
}

/** The ledger row or capture this one may repeat. The card warns and offers `samePayment`. */
export function duplicateOf(proposal: ProposedTransaction): Promise<DuplicateMatch | null> {
  return findProposalDuplicate(proposal.id, proposal);
}
