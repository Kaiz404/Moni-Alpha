import type { MinorAmount, ProposedTransaction, TransactionType } from '@repo/types';

import type { DuplicateMatch } from '@/lib/ai/duplicates';
import { merchantKey } from '@/lib/ai/routine';
import { markCaptureStatus } from '@/lib/notifications/capture-status';
import { canPairInto, pairCapture, toAbsorbedCapture, undoPairing } from '@/lib/proposals/pairing';
import { emitProposedTransactionsChanged } from '@/lib/proposals/proposed-transactions-events';
import { keepProposalReceipt } from '@/lib/receipts/upload-queue';
import { proposedTransactions$, wallets$ } from '@/lib/store';
import { getRecordValues, hasRow, patchRow } from '@/lib/store/helpers';
import {
  createAutoAddRule,
  deleteAutoAddRule,
  listAutoAddRules,
} from '@/lib/supabase/auto-add-rules';
import { getUserId } from '@/lib/supabase/client';
import {
  approveProposedTransaction,
  findProposalDuplicate,
  isOpenProposal,
  laterProposedTransaction,
  rejectProposedTransaction,
  type RejectedProposal,
} from '@/lib/supabase/proposed-transactions';
import { deleteTransaction } from '@/lib/supabase/transactions';
import { captureAlert } from '@/lib/transactions/alert';
import { retypeFields } from '@/lib/transactions/type-change';

/**
 * What the user changed on a capture before deciding. A field left undefined keeps the
 * proposal's value; `walletId: null` means no wallet is picked yet.
 */
export type ReviewEdits = {
  amountMinor?: MinorAmount;
  merchant?: string;
  categoryId?: string | null;
  walletId?: string | null;
  transferToWalletId?: string | null;
  /** The capture was read as the wrong type. Set through `retypeEdits`. */
  type?: TransactionType;
  /** "Don't ask about similar": Approve also adds an auto-add rule for this app and merchant. */
  similar?: boolean;
};

/** The proposed_transactions row as stored, kept so Undo can put it back. */
export type ProposalRowSnapshot = Record<string, unknown> & { id: string };

/** Everything Undo needs. Plain JSON, so a notification can carry it. */
export type ReviewOutcome =
  | {
      action: 'approve';
      proposal: ProposedTransaction;
      row: ProposalRowSnapshot;
      transactionId: string;
      ruleAdded: boolean;
    }
  | { action: 'notMine'; proposal: ProposedTransaction; row: ProposalRowSnapshot }
  | { action: 'pair'; proposal: ProposedTransaction }
  | { action: 'later'; proposal: ProposedTransaction; until: string };

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

function walletCurrency(walletId: string): string | null {
  const wallet = getRecordValues<{ id: string; currency: string | null }>(wallets$).find(
    (w) => w.id === walletId,
  );
  return wallet?.currency?.toUpperCase() ?? null;
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

/** The proposal as it will be written, edits applied. */
export function editedProposal(
  proposal: ProposedTransaction,
  edits: ReviewEdits,
): ProposedTransaction {
  const type = reviewType(proposal, edits);
  const transfer = type === 'transfer';
  const merchant = edits.merchant === undefined ? proposal.merchant : edits.merchant.trim() || null;
  return {
    ...proposal,
    type,
    amountMinor: edits.amountMinor ?? proposal.amountMinor,
    merchant: transfer ? null : merchant,
    categoryId: transfer
      ? null
      : edits.categoryId === undefined
        ? proposal.categoryId
        : edits.categoryId,
    walletId: edits.walletId === undefined ? proposal.walletId : edits.walletId,
    transferToWalletId: !transfer
      ? null
      : edits.transferToWalletId === undefined
        ? proposal.transferToWalletId
        : edits.transferToWalletId,
  };
}

async function addSimilarRule(proposal: ProposedTransaction): Promise<boolean> {
  const key = merchantKey(proposal.merchant);
  if (
    proposal.sourceType !== 'notification' ||
    !proposal.sourceApp ||
    !key ||
    !proposal.walletId ||
    !proposal.categoryId
  ) {
    return false;
  }
  try {
    await createAutoAddRule({
      merchantKey: key,
      sourceApp: proposal.sourceApp,
      walletId: proposal.walletId,
      categoryId: proposal.categoryId,
    });
    return true;
  } catch (error) {
    console.warn('[review] auto-add rule not saved:', messageOf(error, 'unknown'));
    return false;
  }
}

/** Writes the ledger row. Nothing is written until every required field is present. */
export async function approve(
  proposal: ProposedTransaction,
  edits: ReviewEdits = {},
): Promise<ReviewResult> {
  const next = editedProposal(proposal, edits);
  if (!next.walletId) return { status: 'needsInput', field: 'wallet' };
  if (next.type === 'transfer') {
    if (!next.transferToWalletId) return { status: 'needsInput', field: 'destination' };
    if (next.walletId === next.transferToWalletId) {
      return { status: 'error', message: 'Pick two different wallets.' };
    }
    if (walletCurrency(next.walletId) !== walletCurrency(next.transferToWalletId)) {
      return { status: 'error', message: 'Both wallets need the same currency.' };
    }
  }
  if (!next.amountMinor || next.amountMinor <= 0) {
    return { status: 'error', message: 'Enter an amount above zero.' };
  }

  const row = openRow(proposal.id);
  if (!row) return { status: 'error', message: 'This capture was already reviewed.' };
  try {
    const transactionId = await approveProposedTransaction(
      next,
      { walletId: next.walletId, transferToWalletId: next.transferToWalletId },
      captureAlert(proposal, proposal.id),
    );
    keepProposalReceipt(next, transactionId);
    // A rule has no type, so it would add the next alert under the type Moni misread.
    const ruleAdded = edits.similar && !edits.type ? await addSimilarRule(next) : false;
    return {
      status: 'done',
      outcome: { action: 'approve', proposal: next, row, transactionId, ruleAdded },
    };
  } catch (error) {
    return { status: 'error', message: messageOf(error, "Couldn't save. Try again.") };
  }
}

export type ApprovedOutcome = Extract<ReviewOutcome, { action: 'approve' }>;

/** "Don't ask about similar" after Approve, from the Approved notification. */
export async function dontAskAboutSimilar(outcome: ApprovedOutcome): Promise<ApprovedOutcome> {
  if (outcome.ruleAdded) return outcome;
  return { ...outcome, ruleAdded: await addSimilarRule(outcome.proposal) };
}

export async function notMine(proposal: ProposedTransaction): Promise<ReviewResult> {
  const row = openRow(proposal.id);
  if (!row) return { status: 'error', message: 'This capture was already reviewed.' };
  try {
    await rejectProposedTransaction(proposal.id);
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
 * capture stays in Review with the merchant the alert named. A bank's alert is spending out of that
 * wallet; with no source wallet the alert came from the side the money arrived in.
 */
export function notATransfer(proposal: ProposedTransaction): void {
  patchRow(proposedTransactions$, proposal.id, {
    type: proposal.walletId ? 'expense' : 'income',
    wallet_id: proposal.walletId ?? proposal.transferToWalletId,
    transfer_to_wallet_id: null,
    description: null,
    updated_at: new Date().toISOString(),
  });
  emitProposedTransactionsChanged();
}

/** Neither XA-Review nor XA-Notification names a snooze, so Later waits until 8 am tomorrow. */
export function laterUntil(now: Date = new Date()): Date {
  const until = new Date(now);
  until.setDate(until.getDate() + 1);
  until.setHours(8, 0, 0, 0);
  return until;
}

export async function later(
  proposal: ProposedTransaction,
  now: Date = new Date(),
): Promise<ReviewResult> {
  const until = laterUntil(now);
  try {
    laterProposedTransaction(proposal.id, until);
    return {
      status: 'done',
      outcome: { action: 'later', proposal, until: until.toISOString() },
    };
  } catch (error) {
    return { status: 'error', message: messageOf(error, "Couldn't save. Try again.") };
  }
}

function restoreRow(row: ProposalRowSnapshot): void {
  const pending = { status: 'pending', snoozed_until: null, updated_at: new Date().toISOString() };
  if (hasRow(proposedTransactions$, row.id)) {
    patchRow(proposedTransactions$, row.id, { ...pending, reviewed_at: null, transaction_id: null });
  } else {
    proposedTransactions$[row.id].set({ ...row, ...pending, deleted: false });
  }
  if (row.source_type === 'notification') markCaptureStatus(row.id, 'waiting_for_review');
  emitProposedTransactionsChanged();
}

export function moveBackToReview(proposal: RejectedProposal): void {
  const row = proposedTransactions$[proposal.id].peek() as ProposalRowSnapshot | undefined;
  if (row) restoreRow(row);
}

async function removeSimilarRule(proposal: ProposedTransaction): Promise<void> {
  const userId = await getUserId();
  const key = merchantKey(proposal.merchant);
  if (!userId || !key) return;
  const rule = listAutoAddRules(userId).find(
    (r) => r.sourceApp === proposal.sourceApp && r.merchantKey === key,
  );
  if (rule) deleteAutoAddRule(rule.id);
}

/** Puts the capture back in review. Every write sets values, so running it twice converges. */
export async function undo(outcome: ReviewOutcome): Promise<void> {
  switch (outcome.action) {
    case 'approve':
      await deleteTransaction(outcome.transactionId);
      if (outcome.ruleAdded) await removeSimilarRule(outcome.proposal);
      restoreRow(outcome.row);
      return;
    case 'notMine':
      restoreRow(outcome.row);
      return;
    case 'pair':
      await undoPairing(outcome.proposal.id);
      return;
    case 'later':
      patchRow(proposedTransactions$, outcome.proposal.id, {
        status: 'pending',
        snoozed_until: null,
        updated_at: new Date().toISOString(),
      });
      emitProposedTransactionsChanged();
      return;
  }
}

/** The ledger row or capture this one may repeat. The card warns and offers `samePayment`. */
export function duplicateOf(proposal: ProposedTransaction): Promise<DuplicateMatch | null> {
  return findProposalDuplicate(proposal.id, proposal);
}
