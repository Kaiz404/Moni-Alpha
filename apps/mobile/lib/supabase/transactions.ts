import { transactions$ } from '@/lib/store';
import { getRecordValues, hasRow, patchRow } from '@/lib/store/helpers';
import { commit, ledgerView, planContext } from '@/lib/store/writes';
import type { CreateTransaction, TransactionSource, UpdateTransaction } from '@repo/types';
import { decimalToMinor } from '@repo/types';
import {
  planBalanceCorrection,
  planTransaction,
  planTransactionEdit,
  planTransactionsDelete,
  planTransfer,
  touchesWallet,
  type BalanceCorrection,
  type TransferInput,
} from '@repo/core';

type TransactionRow = {
  id: string;
  user_id: string | null;
  wallet_id: string | null;
  amount: string | number | null;
  currency: string | null;
  type: string | null;
  analysis_excluded?: boolean | number | null;
  debt_activity_id?: string | null;
  category_id: string | null;
  transfer_to_wallet_id: string | null;
  linked_transaction_id: string | null;
  description: string | null;
  merchant: string | null;
  notes: string | null;
  transaction_date: string | null;
  location_latitude: string | number | null;
  location_longitude: string | number | null;
  location_name: string | null;
  place_id?: string | null;
  place_coords_at?: string | null;
  receipt_image_url: string | null;
  metadata: string | Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
  deleted?: boolean;
};

/** Normalize persisted transaction_date values (string, epoch ms, etc.) for sorting/display. */
function toDateSortKey(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString();
}

function mapTransactionRow(t: TransactionRow) {
  let metadata: Record<string, unknown> = {};
  if (typeof t.metadata === 'string' && t.metadata) {
    try {
      metadata = JSON.parse(t.metadata) as Record<string, unknown>;
    } catch {
      metadata = {};
    }
  } else if (t.metadata && typeof t.metadata === 'object') {
    metadata = t.metadata as Record<string, unknown>;
  }

  return {
    id: t.id,
    userId: t.user_id ?? '',
    walletId: t.wallet_id ?? '',
    amountMinor: decimalToMinor(t.amount),
    currency: (t.currency ?? 'USD').toUpperCase(),
    type: t.type,
    analysisExcluded: t.analysis_excluded === true || t.analysis_excluded === 1,
    debtActivityId: t.debt_activity_id ?? null,
    categoryId: t.category_id,
    transferToWalletId: t.transfer_to_wallet_id,
    linkedTransactionId: t.linked_transaction_id,
    description: t.description,
    merchant: t.merchant,
    notes: t.notes,
    transactionDate: toDateSortKey(t.transaction_date) || toDateSortKey(t.created_at),
    locationLatitude: t.location_latitude != null ? parseFloat(String(t.location_latitude)) : null,
    locationLongitude:
      t.location_longitude != null ? parseFloat(String(t.location_longitude)) : null,
    locationName: t.location_name,
    placeId: t.place_id ?? null,
    placeCoordsAt: t.place_coords_at ?? null,
    receiptImageUrl: t.receipt_image_url,
    metadata,
    createdAt: t.created_at ?? t.updated_at ?? '',
    updatedAt: t.updated_at ?? t.created_at ?? '',
  };
}

export async function getTransactions(walletId?: string, limit: number = 100) {
  let rows = getRecordValues<TransactionRow>(transactions$);

  rows.sort((a, b) =>
    toDateSortKey(b.transaction_date).localeCompare(toDateSortKey(a.transaction_date)),
  );
  const transactions = rows.map(mapTransactionRow);
  return (
    walletId
      ? transactions.filter((transaction) => touchesWallet(transaction, walletId))
      : transactions
  ).slice(0, limit);
}

export async function getTransactionById(id: string) {
  const t = getRecordValues<TransactionRow>(transactions$).find((row) => row.id === id);
  if (!t) return null;
  return mapTransactionRow(t);
}

export async function updateTransaction(id: string, data: UpdateTransaction) {
  const ctx = await planContext();
  commit(planTransactionEdit(id, data, ledgerView(), ctx));
  return getTransactionById(id);
}

export type PlaceCoordsUpdate = {
  latitude: number | null;
  longitude: number | null;
  placeCoordsAt: string | null;
};

/** The place-coordinate refresh's write: fresh Google coordinates, or none once they expire. */
export function setPlaceCoords(id: string, update: PlaceCoordsUpdate): void {
  patchRow(transactions$, id, {
    location_latitude: update.latitude,
    location_longitude: update.longitude,
    place_coords_at: update.placeCoordsAt,
    updated_at: new Date().toISOString(),
  });
}

export function transactionExists(id: string): boolean {
  return hasRow(transactions$, id);
}

export async function createTransaction(
  data: CreateTransaction,
  source: TransactionSource,
  options?: { id?: string },
) {
  const ctx = await planContext();
  const { id } = commit(planTransaction(data, source, ledgerView(), ctx, options?.id));
  const result = await getTransactionById(id);
  if (!result) throw new Error('Failed to create transaction');
  return result;
}

export async function createTransfer(data: TransferInput, source: TransactionSource) {
  const ctx = await planContext();
  const { id } = commit(planTransfer(data, source, ledgerView(), ctx));
  const result = await getTransactionById(id);
  if (!result) throw new Error('Failed to create transaction');
  return result;
}

/** Writes the row `correctBalance` built. Returns the created transaction so the caller can undo it. */
export async function createBalanceCorrection(walletId: string, correction: BalanceCorrection) {
  const ctx = await planContext();
  const { id } = commit(planBalanceCorrection(walletId, correction, ledgerView(), ctx));
  const result = await getTransactionById(id);
  if (!result) throw new Error('Failed to create transaction');
  return result;
}

export async function deleteTransaction(id: string) {
  commit(planTransactionsDelete([id], { now: new Date().toISOString() }));
}

export function setTransactionReceipt(id: string, url: string): void {
  patchRow(transactions$, id, {
    receipt_image_url: url,
    updated_at: new Date().toISOString(),
  });
}
