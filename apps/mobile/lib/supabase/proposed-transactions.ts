import {
  assertMigrated,
  isMigrated,
  proposedTransactions$,
  transactions$,
  wallets$,
} from '@/lib/store';
import { getRecordValues, hasRow, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';
import { randomUUID } from 'expo-crypto';
import {
  capturePairingSchema,
  decimalToMinor,
  minorToDecimal,
  proposedTransactionStatusSchema,
  type CreateProposedTransaction,
  type ProposedTransaction,
  type ProposedTransactionSourceType,
  type TransactionAlert,
  type TransactionSource,
} from '@repo/types';
import { createTransaction, getTransactions } from './transactions';
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

export type ProposedTransactionRow = {
  id: string;
  user_id: string | null;
  source_type: string | null;
  source_app: string | null;
  source_text: string | null;
  source_image_uri: string | null;
  notification_title: string | null;
  notification_body: string | null;
  notification_received_at: string | null;
  ai_reasoning: string | null;
  ai_confidence: string | number | null;
  wallet_id: string | null;
  wallet_hint: string | null;
  transfer_to_wallet_id: string | null;
  transfer_to_wallet_hint: string | null;
  amount: string | number | null;
  currency: string | null;
  type: string | null;
  description: string | null;
  merchant: string | null;
  category_id: string | null;
  category_hint: string | null;
  transaction_date: string | null;
  status: string | null;
  snoozed_until?: string | null;
  reviewed_at?: string | null;
  transaction_id?: string | null;
  pairing?: unknown;
  created_at: string | null;
  updated_at: string | null;
  deleted?: boolean;
};

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
export const REVIEW_HISTORY_DAYS = 30;
export const REVIEW_RETENTION_DAYS = 90;

export function rowToProposedTransaction(row: ProposedTransactionRow): ProposedTransaction {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    sourceType: (row.source_type ?? 'notification') as ProposedTransaction['sourceType'],
    sourceApp: row.source_app,
    sourceText: row.source_text ?? null,
    sourceImageUri: row.source_image_uri ?? null,
    notificationTitle: row.notification_title,
    notificationBody: row.notification_body,
    notificationReceivedAt: row.notification_received_at,
    aiReasoning: row.ai_reasoning,
    aiConfidence: row.ai_confidence != null ? parseFloat(String(row.ai_confidence)) : null,
    walletId: row.wallet_id,
    walletHint: row.wallet_hint,
    transferToWalletId: row.transfer_to_wallet_id,
    transferToWalletHint: row.transfer_to_wallet_hint,
    amountMinor: row.amount != null ? decimalToMinor(row.amount) : null,
    currency: row.currency ?? 'USD',
    type: row.type as ProposedTransaction['type'],
    description: row.description,
    merchant: row.merchant,
    categoryId: row.category_id,
    categoryHint: row.category_hint,
    transactionDate: row.transaction_date,
    status: proposedTransactionStatusSchema.catch('pending').parse(row.status),
    snoozedUntil: row.snoozed_until ?? null,
    reviewedAt: row.reviewed_at ?? null,
    transactionId: row.transaction_id ?? null,
    pairing: capturePairingSchema.safeParse(row.pairing).data ?? null,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function isReviewableRow(row: ProposedTransactionRow): boolean {
  if (row.amount == null || !row.type) return false;
  try {
    return decimalToMinor(row.amount) > 0;
  } catch {
    return false;
  }
}

export function isUnreviewed(proposal: Pick<ProposedTransaction, 'status'>): boolean {
  return proposal.status === 'pending' || proposal.status === 'later';
}

export type ReviewedProposal = ProposedTransaction & {
  status: 'approved' | 'rejected';
  reviewedAt: string;
};
export type RejectedProposal = ReviewedProposal & { status: 'rejected' };

function asReviewed(proposal: ProposedTransaction): ReviewedProposal | null {
  const { status, reviewedAt } = proposal;
  return (status === 'approved' || status === 'rejected') && reviewedAt
    ? { ...proposal, status, reviewedAt }
    : null;
}

function readProposals(): ProposedTransaction[] {
  return getRecordValues<ProposedTransactionRow>(proposedTransactions$)
    .filter(isReviewableRow)
    .map(rowToProposedTransaction);
}

function readUnreviewedProposals(): ProposedTransaction[] {
  return readProposals()
    .filter(isUnreviewed)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function readReviewedProposals(): ReviewedProposal[] {
  return readProposals().flatMap((proposal) => asReviewed(proposal) ?? []);
}

export function isOpenProposal(id: string): boolean {
  const row = proposedTransactions$[id].peek() as ProposedTransactionRow | undefined;
  return !!row && !row.deleted && isUnreviewed(rowToProposedTransaction(row));
}

/** Safe in a reactive selector. */
export function listRecentlyReviewed(now = new Date()): ReviewedProposal[] {
  const since = now.getTime() - REVIEW_HISTORY_DAYS * DAY_MS;
  return readReviewedProposals()
    .filter((proposal) => Date.parse(proposal.reviewedAt) >= since)
    .sort((a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt));
}

export function pruneReviewHistory(now = new Date()): number {
  const before = now.getTime() - REVIEW_RETENTION_DAYS * DAY_MS;
  const old = readReviewedProposals().filter(
    (proposal) => Date.parse(proposal.reviewedAt) < before,
  );
  for (const proposal of old) softDelete(proposal.id);
  return old.length;
}

export function isAwaitingReview(
  proposal: Pick<ProposedTransaction, 'status' | 'snoozedUntil'>,
  now: Date,
): boolean {
  if (proposal.status === 'pending') return true;
  if (proposal.status !== 'later') return false;
  return !proposal.snoozedUntil || Date.parse(proposal.snoozedUntil) <= now.getTime();
}

/** Captures waiting for a decision, newest first. Reads the store, so it is safe in a reactive selector. */
export function listAwaitingReview(now = new Date()): ProposedTransaction[] {
  return readUnreviewedProposals().filter((proposal) => isAwaitingReview(proposal, now));
}

export async function getProposedTransactions(now = new Date()): Promise<ProposedTransaction[]> {
  return listAwaitingReview(now);
}

export function laterProposedTransaction(id: string, until: Date): void {
  assertMigrated('review_later_and_auto_add_rules');
  patchRow(proposedTransactions$, id, {
    status: 'later',
    snoozed_until: until.toISOString(),
    updated_at: new Date().toISOString(),
  });
  emitProposedTransactionsChanged();
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
  const result = rowToProposedTransaction(created);
  emitProposedTransactionsChanged();
  return result;
}

export async function approveProposedTransaction(
  proposal: ProposedTransaction,
  wallets: { walletId: string; transferToWalletId?: string | null },
  alert?: TransactionAlert,
  /** Moni completed this capture without asking, so the row is marked Auto. */
  added: { automatically: boolean } = { automatically: false },
): Promise<string> {
  if (!proposal.amountMinor || !proposal.type) {
    throw new Error('Cannot approve: amount or type is missing');
  }

  const walletId = wallets.walletId;
  const transferToWalletId = wallets.transferToWalletId ?? proposal.transferToWalletId ?? null;

  if (proposal.type === 'transfer' && !transferToWalletId) {
    throw new Error('Cannot approve transfer: destination wallet is required');
  }
  if (proposal.type === 'transfer' && walletId === transferToWalletId) {
    throw new Error('Source and destination wallets must differ');
  }

  const earlyLocation = getProposalLocationSnapshot(proposal.id);

  const transaction = await createTransaction({
    walletId,
    amountMinor: proposal.amountMinor,
    type: proposal.type,
    transferToWalletId: proposal.type === 'transfer' ? transferToWalletId : null,
    categoryId: proposal.categoryId ?? null,
    description: proposal.description ?? null,
    merchant: proposal.merchant ?? null,
    transactionDate: proposal.transactionDate ?? new Date().toISOString(),
    locationLatitude: earlyLocation?.latitude ?? null,
    locationLongitude: earlyLocation?.longitude ?? null,
    locationName: earlyLocation?.name ?? null,
    metadata: {
      ...(alert ? { alert } : {}),
      ...(proposal.pairing ? { pairing: proposal.pairing } : {}),
      ...(added.automatically ? { ai_suggested: true } : {}),
    },
  }, proposalSource(proposal.sourceType));

  closeProposal(proposal, 'approved', transaction.id);
  return transaction.id;
}

export async function rejectProposedTransaction(id: string): Promise<void> {
  const row = proposedTransactions$[id].peek() as ProposedTransactionRow | undefined;
  if (!row) throw new Error(`Cannot reject missing proposal: ${id}`);
  closeProposal(rowToProposedTransaction(row), 'rejected');
}

/** Before review_history is pushed there is no reviewed_at column, so the row is soft-deleted. */
function closeProposal(
  proposal: Pick<ProposedTransaction, 'id' | 'sourceType' | 'pairing'>,
  status: 'approved' | 'rejected',
  transactionId?: string,
): void {
  if (proposal.sourceType === 'notification') {
    // run-extraction stores a notification's proposal under the id of its capture log entry.
    if (status === 'approved') markCaptureStatus(proposal.id, 'added', transactionId);
    else markCaptureStatus(proposal.id, 'ignored');
  }
  const absorbed = proposal.pairing?.absorbed;
  if (absorbed?.sourceType === 'notification') {
    if (status === 'approved') markCaptureStatus(absorbed.id, 'same_payment', transactionId);
    else markCaptureStatus(absorbed.id, 'ignored');
  }
  const now = new Date().toISOString();
  if (!isMigrated('review_history')) {
    patchRow(proposedTransactions$, proposal.id, { status, updated_at: now });
    softDelete(proposal.id);
    return;
  }
  patchRow(proposedTransactions$, proposal.id, {
    status,
    reviewed_at: now,
    transaction_id: transactionId ?? null,
    updated_at: now,
  });
  clearProposalLocationSnapshot(proposal.id);
  emitProposedTransactionsChanged();
}

export async function updateProposalImageUri(id: string, remoteUrl: string): Promise<boolean> {
  // Image uploads can finish before extraction creates the proposal row — skip until then.
  if (!hasRow(proposedTransactions$, id)) return false;

  patchRow(proposedTransactions$, id, {
    source_image_uri: remoteUrl,
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

type WalletRow = {
  id: string;
  name: string | null;
  type: string | null;
  notification_package?: string | null;
};

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
  const proposals = readUnreviewedProposals();
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
