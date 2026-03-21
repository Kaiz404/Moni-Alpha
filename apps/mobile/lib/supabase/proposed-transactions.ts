import { syncSystem } from '@/lib/powersync/Powersync';
import { randomUUID } from 'expo-crypto';
import type { CreateProposedTransaction, ProposedTransaction } from '@repo/types';
import { createTransaction } from './transactions';
import {
  getProposalLocationSnapshot,
  clearProposalLocationSnapshot,
} from '@/lib/ai/proposal-location-cache';
import { emitProposedTransactionsChanged } from '@/lib/proposals/proposed-transactions-events';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToProposedTransaction(row: any): ProposedTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    sourceType: row.source_type ?? 'notification',
    sourceApp: row.source_app,
    sourceText: row.source_text ?? null,
    sourceImageUri: row.source_image_uri ?? null,
    notificationTitle: row.notification_title,
    notificationBody: row.notification_body,
    notificationReceivedAt: row.notification_received_at,
    aiReasoning: row.ai_reasoning,
    aiConfidence: row.ai_confidence ? parseFloat(row.ai_confidence) : null,
    walletId: row.wallet_id,
    walletHint: row.wallet_hint,
    amount: row.amount ? parseFloat(row.amount) : null,
    currency: row.currency ?? 'USD',
    type: row.type as ProposedTransaction['type'],
    description: row.description,
    merchant: row.merchant,
    categoryId: row.category_id,
    categoryHint: row.category_hint,
    transactionDate: row.transaction_date,
    status: row.status as ProposedTransaction['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getProposedTransactions(
  status?: ProposedTransaction['status'],
): Promise<ProposedTransaction[]> {
  const { db } = syncSystem;

  let query = db
    .selectFrom('proposed_transactions')
    .selectAll()
    .orderBy('created_at', 'desc');

  if (status) {
    query = query.where('status', '=', status);
  }

  const rows = await query.execute();
  return rows.map(rowToProposedTransaction);
}

export async function createProposedTransaction(
  data: CreateProposedTransaction,
): Promise<ProposedTransaction> {
  const { db, supabaseConnector } = syncSystem;

  const userId = await supabaseConnector.getUserId();
  if (!userId) throw new Error('User ID required');

  const id = randomUUID();
  const now = new Date().toISOString();

  const result = await db
    .insertInto('proposed_transactions')
    .values({
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
      ai_confidence: data.aiConfidence?.toString() ?? null,
      wallet_id: data.walletId ?? null,
      wallet_hint: data.walletHint ?? null,
      amount: data.amount?.toString() ?? null,
      currency: data.currency ?? 'USD',
      type: data.type ?? null,
      description: data.description ?? null,
      merchant: data.merchant ?? null,
      category_id: data.categoryId ?? null,
      category_hint: data.categoryHint ?? null,
      transaction_date: data.transactionDate ?? null,
      status: data.status ?? 'pending',
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirst();

  if (!result) throw new Error('Failed to create proposed transaction');
  const created = rowToProposedTransaction(result);
  emitProposedTransactionsChanged();
  return created;
}

/** Mark a proposal as approved and create the real transaction record. */
export async function approveProposedTransaction(
  proposal: ProposedTransaction,
  walletId: string,
): Promise<void> {
  const { db } = syncSystem;

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
  await db
    .updateTable('proposed_transactions')
    .set({ status: 'approved', updated_at: now })
    .where('id', '=', proposal.id)
    .execute();

  clearProposalLocationSnapshot(proposal.id);
  emitProposedTransactionsChanged();
}

/** Mark a proposal as rejected (keeps it in history but removes it from the pending list). */
export async function rejectProposedTransaction(id: string): Promise<void> {
  const { db } = syncSystem;

  await db
    .updateTable('proposed_transactions')
    .set({ status: 'rejected', updated_at: new Date().toISOString() })
    .where('id', '=', id)
    .execute();

  clearProposalLocationSnapshot(id);
  emitProposedTransactionsChanged();
}

/** Update the image URI once a receipt has been uploaded to Supabase Storage. */
export async function updateProposalImageUri(
  id: string,
  remoteUrl: string,
): Promise<void> {
  const { db } = syncSystem;
  await db
    .updateTable('proposed_transactions')
    .set({ source_image_uri: remoteUrl, updated_at: new Date().toISOString() })
    .where('id', '=', id)
    .execute();
  emitProposedTransactionsChanged();
}

export async function deleteProposedTransaction(id: string): Promise<void> {
  const { db } = syncSystem;
  await db.deleteFrom('proposed_transactions').where('id', '=', id).execute();
  clearProposalLocationSnapshot(id);
  emitProposedTransactionsChanged();
}
