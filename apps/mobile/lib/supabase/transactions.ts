import type { StoredRow } from '@repo/core';
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
  toFinanceTransaction,
  touchesWallet,
  type FinanceTransaction,
  type BalanceCorrection,
  type TransferInput,
} from '@repo/core';

type TransactionRow = StoredRow<'transactions'>;

/** Normalize persisted transaction_date values (string, epoch ms, etc.) for sorting/display. */


function liveTransactions(): FinanceTransaction[] {
  return getRecordValues<TransactionRow>(transactions$).flatMap((row) => toFinanceTransaction(row) ?? []);
}

export async function getTransactions(walletId?: string, limit: number = 100) {
  const transactions = liveTransactions().sort((a, b) =>
    b.transactionDate.localeCompare(a.transactionDate),
  );
  return (
    walletId
      ? transactions.filter((transaction) => touchesWallet(transaction, walletId))
      : transactions
  ).slice(0, limit);
}

export async function getTransactionById(id: string) {
  const row = getRecordValues<TransactionRow>(transactions$).find((item) => item.id === id);
  return row ? toFinanceTransaction(row) : null;
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
