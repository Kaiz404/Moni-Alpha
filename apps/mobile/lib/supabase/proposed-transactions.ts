import { proposedTransactions$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';
import { randomUUID } from 'expo-crypto';
import type { CreateProposedTransaction, ProposedTransaction } from '@repo/types';
import { createTransaction } from './transactions';
import {
  getProposalLocationSnapshot,
  clearProposalLocationSnapshot,
} from '@/lib/ai/proposal-location-cache';
import { emitProposedTransactionsChanged } from '@/lib/proposals/proposed-transactions-events';

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
  created_at: string | null;
  updated_at: string | null;
  deleted?: boolean;
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
    amount: row.amount != null ? parseFloat(String(row.amount)) : null,
    currency: row.currency ?? 'USD',
    type: row.type as ProposedTransaction['type'],
    description: row.description,
    merchant: row.merchant,
    categoryId: row.category_id,
    categoryHint: row.category_hint,
    transactionDate: row.transaction_date,
    status: 'pending',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

/** All non-deleted rows are unreviewed proposals awaiting user action. */
export async function getProposedTransactions(): Promise<ProposedTransaction[]> {
  const rows = getRecordValues<ProposedRow>(proposedTransactions$);

  rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  return rows.map(rowToProposedTransaction);
}

export async function createProposedTransaction(
  data: CreateProposedTransaction,
): Promise<ProposedTransaction> {
  const userId = await getUserId();
  if (!userId) throw new Error('User ID required');

  const id = randomUUID();

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
    amount: data.amount ?? null,
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
  if (!proposal.amount || !proposal.type) {
    throw new Error('Cannot approve: amount or type is missing');
  }

  const walletId = wallets.walletId;
  const transferToWalletId =
    wallets.transferToWalletId ?? proposal.transferToWalletId ?? null;

  if (proposal.type === 'transfer' && !transferToWalletId) {
    throw new Error('Cannot approve transfer: destination wallet is required');
  }
  if (proposal.type === 'transfer' && walletId === transferToWalletId) {
    throw new Error('Source and destination wallets must differ');
  }

  const earlyLocation = getProposalLocationSnapshot(proposal.id);

  await createTransaction({
    walletId,
    amount: proposal.amount,
    type: proposal.type,
    transferToWalletId: proposal.type === 'transfer' ? transferToWalletId : null,
    categoryId: proposal.categoryId ?? null,
    description: proposal.description ?? null,
    merchant: proposal.merchant ?? null,
    transactionDate: proposal.transactionDate ?? new Date().toISOString(),
    locationLatitude: earlyLocation?.latitude ?? null,
    locationLongitude: earlyLocation?.longitude ?? null,
    locationName: earlyLocation?.name ?? null,
  });

  await deleteProposedTransaction(proposal.id);
}

export async function rejectProposedTransaction(id: string): Promise<void> {
  await deleteProposedTransaction(id);
}

export async function updateProposalImageUri(id: string, remoteUrl: string): Promise<void> {
  patchRow(proposedTransactions$, id, {
    source_image_uri: remoteUrl,
    updated_at: new Date().toISOString(),
  });
  emitProposedTransactionsChanged();
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
