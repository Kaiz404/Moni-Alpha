import {
  inboxOrder,
  planReview,
  reviewedLately,
  reviewedProposals,
  toProposal,
  type CaptureMark,
  type Planned,
  type ReviewChanges,
  type ReviewContext,
  type ReviewDecision,
  type ReviewedProposal,
  type ReviewView,
  type StoredRow,
} from '@repo/core';
import {
  autoAddRules$,
  isMigrated,
  proposedTransactions$,
  wallets$,
} from '@/lib/store';
import { getRecordValues, hasRow, patchRow } from '@/lib/store/helpers';
import { commit, ledgerView, planContext } from '@/lib/store/writes';
import { getUserId } from '@/lib/supabase/client';
import { randomUUID } from 'expo-crypto';
import {
  decimalToMinor,
  minorToDecimal,
  type CreateProposedTransaction,
  type ProposedTransaction,
  type ProposedTransactionSourceType,
  type TransactionSource,
} from '@repo/types';
import { getTransactions } from './transactions';
import { findDuplicate, type DuplicateMatch, type LedgerEntry } from '@/lib/ai/duplicates';
import {
  institutionOfWallet,
  moneySideOfWallet,
  type InstitutionWallet,
} from '@/lib/ai/institutions';
import { transactionPairing } from '@/lib/transactions/alert';
import {
  getProposalLocationSnapshot,
  clearProposalLocationSnapshot,
} from '@/lib/ai/proposal-location-cache';
import { emitProposedTransactionsChanged } from '@/lib/proposals/proposed-transactions-events';
import { markCaptureStatus } from '@/lib/notifications/capture-status';

export type ProposedTransactionRow = StoredRow<'proposed_transactions'>;

const TRANSACTION_SOURCE_BY_PROPOSAL_SOURCE: Record<
  ProposedTransactionSourceType,
  TransactionSource
> = {
  notification: 'notification',
  text: 'moni',
  image: 'camera',
};

export function proposalSource(sourceType: ProposedTransactionSourceType): TransactionSource {
  return TRANSACTION_SOURCE_BY_PROPOSAL_SOURCE[sourceType];
}

const DAY_MS = 86_400_000;
export const REVIEW_RETENTION_DAYS = 90;

function isReviewableRow(row: ProposedTransactionRow): boolean {
  if (row.amount == null || !row.type) return false;
  try {
    return decimalToMinor(row.amount) > 0;
  } catch {
    return false;
  }
}

export function isUnreviewed(proposal: Pick<ProposedTransaction, 'status'>): boolean {
  return proposal.status === 'pending';
}

function readProposals(): ProposedTransaction[] {
  return getRecordValues<ProposedTransactionRow>(proposedTransactions$)
    .filter(isReviewableRow)
    .flatMap((row) => toProposal(row) ?? []);
}

/** Captures waiting for a decision, newest first. Reads the store, so it is safe in a reactive selector. */
export function listAwaitingReview(): ProposedTransaction[] {
  return inboxOrder(readProposals().filter(isUnreviewed));
}

export function isOpenProposal(id: string): boolean {
  const row = proposedTransactions$[id].peek() as ProposedTransactionRow | undefined;
  const proposal = row ? toProposal(row) : null;
  return !!proposal && isUnreviewed(proposal);
}

/** Safe in a reactive selector. */
export function listRecentlyReviewed(now = new Date()): ReviewedProposal[] {
  return reviewedLately(readProposals(), now);
}

export function pruneReviewHistory(now = new Date()): number {
  const before = now.getTime() - REVIEW_RETENTION_DAYS * DAY_MS;
  const old = reviewedProposals(readProposals()).filter(
    (proposal) => Date.parse(proposal.reviewedAt) < before,
  );
  for (const proposal of old) softDelete(proposal.id);
  return old.length;
}

export async function getProposedTransactions(): Promise<ProposedTransaction[]> {
  return listAwaitingReview();
}

/** Soft-delete stub rows left by image-upload races (no amount/type). Safe to call on startup. */
export async function pruneIncompleteProposals(): Promise<number> {
  const rows = getRecordValues<ProposedTransactionRow>(proposedTransactions$);
  let pruned = 0;

  for (const row of rows) {
    if (isReviewableRow(row)) continue;
    try {
      softDelete(row.id);
      pruned++;
    } catch {
      // row already removed
    }
  }

  return pruned;
}

export function proposalExists(id: string): boolean {
  return hasRow(proposedTransactions$, id);
}

export async function createProposedTransaction(
  data: CreateProposedTransaction,
  options?: { id?: string },
): Promise<ProposedTransaction> {
  const userId = await getUserId();
  if (!userId) throw new Error('User ID required');

  const id = options?.id ?? randomUUID();

  proposedTransactions$[id].set({
    id,
    user_id: userId,
    source_type: data.sourceType ?? 'notification',
    source_app: data.sourceApp ?? null,
    source_text: data.sourceText ?? null,
    source_image_uri: data.sourceImageUri ?? null,
    notification_title: data.notificationTitle ?? null,
    notification_body: data.notificationBody ?? null,
    notification_received_at: data.notificationReceivedAt ?? null,
    ai_reasoning: data.aiReasoning ?? null,
    ai_confidence: data.aiConfidence ?? null,
    wallet_id: data.walletId ?? null,
    wallet_hint: data.walletHint ?? null,
    transfer_to_wallet_id: data.transferToWalletId ?? null,
    transfer_to_wallet_hint: data.transferToWalletHint ?? null,
    amount: data.amountMinor == null ? null : minorToDecimal(data.amountMinor),
    currency: data.currency ?? 'USD',
    type: data.type ?? null,
    description: data.description ?? null,
    merchant: data.merchant ?? null,
    category_id: data.categoryId ?? null,
    category_hint: data.categoryHint ?? null,
    transaction_date: data.transactionDate ?? null,
    status: data.status ?? 'pending',
    deleted: false,
  });

  const created = getRecordValues<ProposedTransactionRow>(proposedTransactions$).find((r) => r.id === id);
  if (!created) throw new Error('Failed to create proposed transaction');
  const result = toProposal(created);
  if (!result) throw new Error('Failed to create proposed transaction');
  emitProposedTransactionsChanged();
  return result;
}

/** What a review decision reads on the phone: the live wallets and the user's auto-add rules. */
export function reviewView(): ReviewView {
  return {
    walletsById: ledgerView().walletsById,
    autoAddRules: getRecordValues<StoredRow<'auto_add_rules'>>(autoAddRules$),
  };
}

export async function reviewContext(): Promise<ReviewContext> {
  return {
    ...(await planContext()),
    reviewHistory: isMigrated('review_history'),
    autoAddRules: isMigrated('review_later_and_auto_add_rules'),
  };
}

/** The capture log entries a decision names, written on this device. */
export function markCaptures(marks: readonly CaptureMark[]): void {
  for (const { captureId, status, transactionId, pairedProposalId } of marks) {
    if (pairedProposalId) markCaptureStatus(captureId, status, transactionId, pairedProposalId);
    else if (transactionId) markCaptureStatus(captureId, status, transactionId);
    else markCaptureStatus(captureId, status);
  }
}

/**
 * Plans a decision with @repo/core's `planReview`, with where the phone was when the capture
 * arrived. Writes nothing; `applyReview` carries it out.
 */
export async function planDecision(
  proposal: ProposedTransaction,
  decision: ReviewDecision,
): Promise<Planned<ReviewChanges>> {
  const at = decision.kind === 'approve' ? getProposalLocationSnapshot(proposal.id) : null;
  const placed: ReviewDecision =
    decision.kind === 'approve' && at && decision.place === undefined
      ? { ...decision, place: { latitude: at.latitude, longitude: at.longitude, name: at.name ?? null } }
      : decision;
  return planReview(proposal, placed, reviewView(), await reviewContext());
}

/** Writes a planned decision, then the phone's own side: the capture log and the location snapshot. */
export function applyReview(proposalId: string, plan: Planned<ReviewChanges>): ReviewChanges {
  const changes = commit(plan);
  markCaptures(changes.captureMarks);
  clearProposalLocationSnapshot(proposalId);
  emitProposedTransactionsChanged();
  return changes;
}

/** Plans and writes a decision, or throws why it could not. */
export async function commitReview(
  proposal: ProposedTransaction,
  decision: ReviewDecision,
): Promise<ReviewChanges> {
  return applyReview(proposal.id, await planDecision(proposal, decision));
}

export async function updateProposalImageUri(id: string, path: string): Promise<boolean> {
  // Image uploads can finish before extraction creates the proposal row — skip until then.
  if (!hasRow(proposedTransactions$, id)) return false;

  patchRow(proposedTransactions$, id, {
    source_image_uri: path,
    updated_at: new Date().toISOString(),
  });
  emitProposedTransactionsChanged();
  return true;
}

/** A capture folded into another row leaves Review; the other row keeps all of it. */
export function retireProposal(id: string): void {
  if (hasRow(proposedTransactions$, id)) softDelete(id);
}

function softDelete(id: string): void {
  const row$ = proposedTransactions$[id] as { delete?: () => void } | undefined;
  if (!row$?.delete) {
    throw new Error(`Cannot delete missing proposal: ${id}`);
  }
  // Legend-State soft-delete: marks deleted, removes from the observable, and syncs.
  row$.delete();
  clearProposalLocationSnapshot(id);
  emitProposedTransactionsChanged();
}

function ledgerType(type: string | null): LedgerEntry['type'] {
  return type === 'income' || type === 'expense' || type === 'transfer' ? type : null;
}

type WalletRow = StoredRow<'wallets'>;

function readWalletLookup(): Map<string, InstitutionWallet> {
  return new Map(
    getRecordValues<WalletRow>(wallets$).map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        type: row.type,
        notificationPackage: row.notification_package ?? null,
      },
    ]),
  );
}

/** What pairing needs to know about the wallets on either end of a row. */
function walletFacts(
  wallets: ReadonlyMap<string, InstitutionWallet>,
  walletId: string | null,
  transferToWalletId: string | null,
) {
  const wallet = walletId ? wallets.get(walletId) : undefined;
  const to = transferToWalletId ? wallets.get(transferToWalletId) : undefined;
  return {
    side: wallet ? moneySideOfWallet(wallet) : null,
    institutionId: wallet ? (institutionOfWallet(wallet)?.id ?? null) : null,
    transferToInstitutionId: to ? (institutionOfWallet(to)?.id ?? null) : null,
  };
}

function proposalLedgerEntry(
  id: string,
  proposal: Pick<
    CreateProposedTransaction,
    | 'type'
    | 'walletId'
    | 'transferToWalletId'
    | 'currency'
    | 'amountMinor'
    | 'merchant'
    | 'transactionDate'
    | 'sourceType'
  > & { pairing?: ProposedTransaction['pairing'] },
  wallets: ReadonlyMap<string, InstitutionWallet>,
): LedgerEntry {
  const walletId = proposal.walletId ?? null;
  const transferToWalletId = proposal.transferToWalletId ?? null;
  return {
    id,
    kind: 'proposal',
    type: ledgerType(proposal.type ?? null),
    walletId,
    transferToWalletId,
    currency: (proposal.currency ?? 'USD').toUpperCase(),
    amountMinor: proposal.amountMinor ?? null,
    merchant: proposal.merchant ?? null,
    at: proposal.transactionDate ?? '',
    fromAlert: proposal.sourceType === 'notification',
    paired: !!proposal.pairing,
    ...walletFacts(wallets, walletId, transferToWalletId),
  };
}

export async function getLedgerEntries(): Promise<LedgerEntry[]> {
  const transactions = await getTransactions(undefined, 500);
  const proposals = listAwaitingReview();
  const wallets = readWalletLookup();
  return [
    ...transactions
      .filter((t) => !t.debtActivityId && !t.analysisExcluded)
      .map((t): LedgerEntry => {
        const walletId = t.walletId || null;
        const transferToWalletId = t.transferToWalletId ?? null;
        return {
          id: t.id,
          kind: 'transaction',
          type: ledgerType(t.type),
          walletId,
          transferToWalletId,
          currency: t.currency,
          amountMinor: t.amountMinor,
          merchant: t.merchant,
          at: t.transactionDate,
          fromAlert: t.metadata.source === 'notification',
          paired: !!transactionPairing(t.metadata),
          ...walletFacts(wallets, walletId, transferToWalletId),
        };
      }),
    ...proposals.map((p) => proposalLedgerEntry(p.id, p, wallets)),
  ];
}

export async function findProposalDuplicate(
  id: string,
  proposal: Parameters<typeof proposalLedgerEntry>[1],
): Promise<DuplicateMatch | null> {
  return findDuplicate(
    proposalLedgerEntry(id, proposal, readWalletLookup()),
    await getLedgerEntries(),
  );
}
