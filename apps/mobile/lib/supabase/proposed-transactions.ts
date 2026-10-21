import { assertMigrated, proposedTransactions$, transactions$ } from '@/lib/store';
import { getRecordValues, hasRow, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';
import { randomUUID } from 'expo-crypto';
import {
  decimalToMinor,
  minorToDecimal,
  proposedTransactionStatusSchema,
  type CreateProposedTransaction,
  type ProposedTransaction,
  type ProposedTransactionSourceType,
  type TransactionSource,
} from '@repo/types';
import { createTransaction, getTransactions } from './transactions';
import { findDuplicate, type DuplicateMatch, type LedgerEntry } from '@/lib/ai/duplicates';
import {
  getProposalLocationSnapshot,
  clearProposalLocationSnapshot,
} from '@/lib/ai/proposal-location-cache';
import { emitProposedTransactionsChanged } from '@/lib/proposals/proposed-transactions-events';
import { markCaptureStatus } from '@/lib/notifications/capture-status';

type ProposedRow = {
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

function rowToProposedTransaction(row: ProposedRow): ProposedTransaction {
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
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function isReviewableRow(row: ProposedRow): boolean {
  if (row.amount == null || !row.type) return false;
  try {
    return decimalToMinor(row.amount) > 0;
  } catch {
    return false;
  }
}

function readUnreviewedProposals(): ProposedTransaction[] {
  return getRecordValues<ProposedRow>(proposedTransactions$)
    .filter(isReviewableRow)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .map(rowToProposedTransaction)
    .filter((proposal) => proposal.status === 'pending' || proposal.status === 'later');
}

export function isAwaitingReview(
  proposal: Pick<ProposedTransaction, 'status' | 'snoozedUntil'>,
  now: Date,
): boolean {
  if (proposal.status === 'pending') return true;
  if (proposal.status !== 'later') return false;
  return !proposal.snoozedUntil || Date.parse(proposal.snoozedUntil) <= now.getTime();
}

export async function getProposedTransactions(now = new Date()): Promise<ProposedTransaction[]> {
  return readUnreviewedProposals().filter((proposal) => isAwaitingReview(proposal, now));
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
  const rows = getRecordValues<ProposedRow>(proposedTransactions$);
  let pruned = 0;

  for (const row of rows) {
    if (isReviewableRow(row)) continue;
    try {
      await deleteProposedTransaction(row.id);
      pruned++;
    } catch {
      // row already removed
    }
  }

  return pruned;
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

  const created = getRecordValues<ProposedRow>(proposedTransactions$).find((r) => r.id === id);
  if (!created) throw new Error('Failed to create proposed transaction');
  const result = rowToProposedTransaction(created);
  emitProposedTransactionsChanged();
  return result;
}

export async function approveProposedTransaction(
  proposal: ProposedTransaction,
  wallets: { walletId: string; transferToWalletId?: string | null },
): Promise<void> {
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
  }, TRANSACTION_SOURCE_BY_PROPOSAL_SOURCE[proposal.sourceType]);

  closeProposal(proposal, 'approved', transaction.id);
  await deleteProposedTransaction(proposal.id);
}

export async function rejectProposedTransaction(id: string): Promise<void> {
  const row = proposedTransactions$[id].peek() as ProposedRow | undefined;
  if (row) closeProposal(rowToProposedTransaction(row), 'rejected');
  await deleteProposedTransaction(id);
}

/** Stamps the review outcome on the row before its soft delete, so the server keeps it. */
function closeProposal(
  proposal: Pick<ProposedTransaction, 'id' | 'sourceType'>,
  status: 'approved' | 'rejected',
  transactionId?: string,
): void {
  if (proposal.sourceType === 'notification') {
    // run-extraction stores a notification's proposal under the id of its capture log entry.
    if (status === 'approved') markCaptureStatus(proposal.id, 'added', transactionId);
    else markCaptureStatus(proposal.id, 'ignored');
  }
  if (!hasRow(proposedTransactions$, proposal.id)) return;
  patchRow(proposedTransactions$, proposal.id, { status, updated_at: new Date().toISOString() });
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

export async function deleteProposedTransaction(id: string): Promise<void> {
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

function proposalLedgerEntry(
  id: string,
  proposal: Pick<
    CreateProposedTransaction,
    'type' | 'walletId' | 'currency' | 'amountMinor' | 'merchant' | 'transactionDate'
  >,
): LedgerEntry {
  return {
    id,
    kind: 'proposal',
    type: ledgerType(proposal.type ?? null),
    walletId: proposal.walletId ?? null,
    currency: (proposal.currency ?? 'USD').toUpperCase(),
    amountMinor: proposal.amountMinor ?? null,
    merchant: proposal.merchant ?? null,
    at: proposal.transactionDate ?? '',
  };
}

export async function getLedgerEntries(): Promise<LedgerEntry[]> {
  const transactions = await getTransactions(undefined, 500);
  const proposals = readUnreviewedProposals();
  return [
    ...transactions
      .filter((t) => !t.debtActivityId && !t.analysisExcluded)
      .map(
        (t): LedgerEntry => ({
          id: t.id,
          kind: 'transaction',
          type: ledgerType(t.type),
          walletId: t.walletId || null,
          currency: t.currency,
          amountMinor: t.amountMinor,
          merchant: t.merchant,
          at: t.transactionDate,
        }),
      ),
    ...proposals.map((p) => proposalLedgerEntry(p.id, p)),
  ];
}

export async function findProposalDuplicate(
  id: string,
  proposal: Parameters<typeof proposalLedgerEntry>[1],
): Promise<DuplicateMatch | null> {
  return findDuplicate(proposalLedgerEntry(id, proposal), await getLedgerEntries());
}

function missingFields(
  row: Record<string, unknown> | undefined,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value != null && row?.[key] == null),
  );
}

/**
 * Rewrites the target of a transfer pair as one transfer between the two wallets. Runs
 * automatically when a notification completes the pair, so a combined ledger row is marked
 * auto-added. Value-setting only, so running it twice converges.
 */
export function combineIntoTransfer(
  match: Extract<DuplicateMatch, { kind: 'transfer_pair' }>,
): void {
  const { target } = match;
  const transfer = {
    type: 'transfer',
    wallet_id: match.fromWalletId,
    transfer_to_wallet_id: match.toWalletId,
    updated_at: new Date().toISOString(),
  };
  if (target.kind === 'proposal') {
    patchRow(proposedTransactions$, target.id, transfer);
    emitProposedTransactionsChanged();
    return;
  }
  const row = getRecordValues<{ id: string; metadata: unknown }>(transactions$).find(
    (r) => r.id === target.id,
  );
  let metadata: object = {};
  try {
    const raw = typeof row?.metadata === 'string' ? JSON.parse(row.metadata) : row?.metadata;
    if (raw && typeof raw === 'object') metadata = raw;
  } catch {
    // Unreadable metadata is replaced rather than blocking the combine.
  }
  patchRow(transactions$, target.id, {
    ...transfer,
    category_id: null,
    metadata: { ...metadata, ai_suggested: true },
  });
}

/**
 * Applies a user-confirmed duplicate resolution: the proposal is folded into its target and
 * removed. Every write sets values, so re-running after a crash converges.
 */
export async function resolveDuplicate(
  proposal: ProposedTransaction,
  match: DuplicateMatch,
): Promise<void> {
  const { target } = match;
  const table$ = target.kind === 'transaction' ? transactions$ : proposedTransactions$;
  const now = new Date().toISOString();

  if (match.kind === 'same_purchase') {
    const imageUrl = proposal.sourceImageUri?.startsWith('http') ? proposal.sourceImageUri : null;
    const row = getRecordValues<Record<string, unknown>>(table$).find((r) => r.id === target.id);
    const fill = missingFields(row, {
      category_id: proposal.categoryId,
      merchant: proposal.merchant,
      [target.kind === 'transaction' ? 'receipt_image_url' : 'source_image_uri']: imageUrl,
    });
    if (Object.keys(fill).length > 0) {
      patchRow(table$, target.id, { ...fill, updated_at: now });
    }
  } else {
    combineIntoTransfer(match);
  }

  if (hasRow(proposedTransactions$, proposal.id)) {
    await deleteProposedTransaction(proposal.id);
  }
}
