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
    amount: row.amount != null ? parseFloat(String(row.amount)) : null,
    currency: row.currency ?? 'USD',
    type: row.type as ProposedTransaction['type'],
    description: row.description,
    merchant: row.merchant,
    categoryId: row.category_id,
    categoryHint: row.category_hint,
    transactionDate: row.transaction_date,
    status: row.status as ProposedTransaction['status'],
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

export async function getProposedTransactions(
  status?: ProposedTransaction['status'],
): Promise<ProposedTransaction[]> {
  let rows = getRecordValues<ProposedRow>(proposedTransactions$);

  if (status) {
    rows = rows.filter((r) => r.status === status);
  }

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
  walletId: string,
): Promise<void> {
  if (!proposal.amount || !proposal.type) {
    throw new Error('Cannot approve: amount or type is missing');
  }

  const earlyLocation = getProposalLocationSnapshot(proposal.id);

  await createTransaction({
    walletId,
    amount: proposal.amount,
    type: proposal.type,
    categoryId: proposal.categoryId ?? null,
    description: proposal.description ?? null,
    merchant: proposal.merchant ?? null,
    transactionDate: proposal.transactionDate ?? new Date().toISOString(),
    locationLatitude: earlyLocation?.latitude ?? null,
    locationLongitude: earlyLocation?.longitude ?? null,
    locationName: earlyLocation?.name ?? null,
  });

  const now = new Date().toISOString();
  patchRow(proposedTransactions$, proposal.id, {
    status: 'approved',
    updated_at: now,
  });

  clearProposalLocationSnapshot(proposal.id);
  emitProposedTransactionsChanged();
}

export async function rejectProposedTransaction(id: string): Promise<void> {
  patchRow(proposedTransactions$, id, {
    status: 'rejected',
    updated_at: new Date().toISOString(),
  });

  clearProposalLocationSnapshot(id);
  emitProposedTransactionsChanged();
}

export async function updateProposalImageUri(id: string, remoteUrl: string): Promise<void> {
  patchRow(proposedTransactions$, id, {
    source_image_uri: remoteUrl,
    updated_at: new Date().toISOString(),
  });
  emitProposedTransactionsChanged();
}

export async function deleteProposedTransaction(id: string): Promise<void> {
  patchRow(proposedTransactions$, id, {
    deleted: true,
    updated_at: new Date().toISOString(),
  });
  clearProposalLocationSnapshot(id);
  emitProposedTransactionsChanged();
}
