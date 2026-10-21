import type { MinorAmount, ProposedTransaction } from '@repo/types';

import type { DuplicateMatch } from '@/lib/ai/duplicates';
import { merchantKey } from '@/lib/ai/routine';
import { markCaptureStatus } from '@/lib/notifications/capture-status';
import { emitProposedTransactionsChanged } from '@/lib/proposals/proposed-transactions-events';
import { proposedTransactions$, wallets$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import {
  createAutoAddRule,
  deleteAutoAddRule,
  listAutoAddRules,
} from '@/lib/supabase/auto-add-rules';
import { getUserId } from '@/lib/supabase/client';
import {
  approveProposedTransaction,
  findProposalDuplicate,
  laterProposedTransaction,
  rejectProposedTransaction,
} from '@/lib/supabase/proposed-transactions';
import { deleteTransaction } from '@/lib/supabase/transactions';

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
  | { action: 'later'; proposal: ProposedTransaction; until: string };

export type ReviewField = 'wallet' | 'destination';

export type ReviewResult =
  | { status: 'done'; outcome: ReviewOutcome }
  | { status: 'needsInput'; field: ReviewField }
  | { status: 'error'; message: string };

function snapshotRow(id: string): ProposalRowSnapshot | null {
  const row = proposedTransactions$[id].peek() as ProposalRowSnapshot | undefined;
  return row ? { ...row } : null;
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

/** The proposal as it will be written, edits applied. */
export function editedProposal(
  proposal: ProposedTransaction,
  edits: ReviewEdits,
): ProposedTransaction {
  const transfer = proposal.type === 'transfer';
  const merchant = edits.merchant === undefined ? proposal.merchant : edits.merchant.trim() || null;
  return {
    ...proposal,
    amountMinor: edits.amountMinor ?? proposal.amountMinor,
    merchant: transfer ? null : merchant,
    categoryId: transfer
      ? null
      : edits.categoryId === undefined
        ? proposal.categoryId
        : edits.categoryId,
    walletId: edits.walletId === undefined ? proposal.walletId : edits.walletId,
    transferToWalletId:
      edits.transferToWalletId === undefined
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

  const row = snapshotRow(proposal.id);
  if (!row) return { status: 'error', message: 'This capture was already reviewed.' };
  try {
    const transactionId = await approveProposedTransaction(next, {
      walletId: next.walletId,
      transferToWalletId: next.transferToWalletId,
    });
    const ruleAdded = edits.similar ? await addSimilarRule(next) : false;
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

/** Stamps the capture `rejected`, then soft-deletes it (D6: no stored history). */
export async function notMine(proposal: ProposedTransaction): Promise<ReviewResult> {
  const row = snapshotRow(proposal.id);
  if (!row) return { status: 'error', message: 'This capture was already reviewed.' };
  try {
    await rejectProposedTransaction(proposal.id);
    return { status: 'done', outcome: { action: 'notMine', proposal, row } };
  } catch (error) {
    return { status: 'error', message: messageOf(error, "Couldn't save. Try again.") };
  }
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
  proposedTransactions$[row.id].set({
    ...row,
    status: 'pending',
    snoozed_until: null,
    deleted: false,
    updated_at: new Date().toISOString(),
  });
  if (row.source_type === 'notification') markCaptureStatus(row.id, 'waiting_for_review');
  emitProposedTransactionsChanged();
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

/** The ledger row or capture this one may repeat. The card warns; it never merges. */
export function duplicateOf(proposal: ProposedTransaction): Promise<DuplicateMatch | null> {
  return findProposalDuplicate(proposal.id, proposal);
}
