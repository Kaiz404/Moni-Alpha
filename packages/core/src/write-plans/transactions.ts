import {
  minorToDecimal,
  updateTransactionSchema,
  type CreateTransaction,
  type MinorAmount,
  type TransactionSource,
  type UpdateTransaction,
} from '@repo/types';

import { placeLocation, type Place } from '../read-model/places';
import {
  combine,
  planned,
  refused,
  type LedgerView,
  type PlanContext,
  type Planned,
  type StoredPatch,
  type StoredRow,
} from './types';

/**
 * The one transfer rule: a destination, two different wallets the ledger holds, one currency. The
 * Add page, Review and the background processor all ask it.
 */
export function checkTransfer(
  view: Pick<LedgerView, 'walletsById'>,
  walletId: string,
  transferToWalletId: string | null | undefined,
): Exclude<Planned, { kind: 'writes' }> | null {
  if (!transferToWalletId) return { kind: 'needsInput', field: 'destination' };
  if (walletId === transferToWalletId) return refused('Pick two different wallets.');
  const from = view.walletsById[walletId];
  const to = view.walletsById[transferToWalletId];
  if (!from || !to) return refused('Wallet not found');
  if (from.currency !== to.currency) return refused('Both wallets need the same currency.');
  return null;
}

/** A transaction takes its wallet's currency, so a row never mixes two. */
export function planTransaction(
  data: CreateTransaction,
  source: TransactionSource,
  view: Pick<LedgerView, 'walletsById'>,
  ctx: PlanContext,
  id: string = ctx.newId(),
): Planned<{ id: string }> {
  const row: StoredRow<'transactions'> = {
    id,
    user_id: ctx.userId,
    wallet_id: data.walletId,
    amount: minorToDecimal(data.amountMinor),
    currency: view.walletsById[data.walletId]?.currency ?? 'USD',
    type: data.type,
    analysis_excluded: data.analysisExcluded ?? false,
    debt_activity_id: data.debtActivityId ?? null,
    category_id: data.categoryId || null,
    transfer_to_wallet_id: data.transferToWalletId || null,
    linked_transaction_id: null,
    description: data.description || null,
    merchant: data.merchant || null,
    notes: data.notes || null,
    transaction_date: data.transactionDate || ctx.now,
    location_latitude: data.locationLatitude ?? null,
    location_longitude: data.locationLongitude ?? null,
    location_name: data.locationName || null,
    // An unknown column fails the whole row's sync, so these wait for the migration.
    ...(ctx.isMigrated('transaction_place_ids')
      ? { place_id: data.placeId ?? null, place_coords_at: data.placeCoordsAt ?? null }
      : {}),
    receipt_image_url: null,
    metadata: { ...data.metadata, source },
    deleted: false,
  };
  return planned({ insert: [{ table: 'transactions', row }] }, { id });
}

export type TransferInput = {
  fromWalletId: string;
  toWalletId: string;
  amountMinor: MinorAmount;
  description?: string | null;
  notes?: string | null;
  transactionDate?: string;
};

export function planTransfer(
  data: TransferInput,
  source: TransactionSource,
  view: Pick<LedgerView, 'walletsById'>,
  ctx: PlanContext,
): Planned<{ id: string }> {
  if (!Number.isInteger(data.amountMinor) || data.amountMinor <= 0) return refused('Enter an amount above zero.');
  const problem = checkTransfer(view, data.fromWalletId, data.toWalletId);
  if (problem) return problem;
  return planTransaction(
    {
      walletId: data.fromWalletId,
      transferToWalletId: data.toWalletId,
      amountMinor: data.amountMinor,
      type: 'transfer',
      categoryId: null,
      description: data.description ?? null,
      merchant: null,
      notes: data.notes ?? null,
      transactionDate: data.transactionDate,
    },
    source,
    view,
    ctx,
  );
}

/** Debt-linked rows change only through their debt activity, which keeps the mirror and the debt in step. */
export function planTransactionEdit(
  id: string,
  data: UpdateTransaction,
  view: Pick<LedgerView, 'walletsById' | 'transactionsById'>,
  ctx: PlanContext,
): Planned<{ id: string }> {
  if (view.transactionsById[id]?.debtActivityId) {
    return refused('Debt-linked transactions must be changed from the debt activity.');
  }
  const parsed = updateTransactionSchema.safeParse(data);
  if (!parsed.success) return refused(parsed.error.errors[0]?.message ?? 'Invalid update');
  const p = parsed.data;
  const patch: StoredPatch<'transactions'> = { updated_at: ctx.now };
  if (p.walletId !== undefined) patch.wallet_id = p.walletId;
  if (p.amountMinor !== undefined) patch.amount = minorToDecimal(p.amountMinor);
  if (p.type !== undefined) patch.type = p.type;
  if (p.analysisExcluded !== undefined) patch.analysis_excluded = p.analysisExcluded;
  if (p.categoryId !== undefined) patch.category_id = p.categoryId;
  if (p.transferToWalletId !== undefined) patch.transfer_to_wallet_id = p.transferToWalletId;
  if (p.description !== undefined) patch.description = p.description;
  if (p.merchant !== undefined) patch.merchant = p.merchant;
  if (p.notes !== undefined) patch.notes = p.notes;
  if (p.transactionDate !== undefined) patch.transaction_date = p.transactionDate;
  if (p.locationLatitude !== undefined) patch.location_latitude = p.locationLatitude;
  if (p.locationLongitude !== undefined) patch.location_longitude = p.locationLongitude;
  if (p.locationName !== undefined) patch.location_name = p.locationName;
  if (ctx.isMigrated('transaction_place_ids')) {
    if (p.placeId !== undefined) patch.place_id = p.placeId;
    if (p.placeCoordsAt !== undefined) patch.place_coords_at = p.placeCoordsAt;
  }
  if (p.walletId !== undefined) {
    const wallet = view.walletsById[p.walletId];
    if (!wallet) return refused('Wallet not found');
    patch.currency = wallet.currency;
  }
  return planned({ patch: [{ table: 'transactions', id, patch }] }, { id });
}

/** One edit, such as a new category, across many rows: all of them or none. */
export function planTransactionsEdit(
  ids: readonly string[],
  data: UpdateTransaction,
  view: Pick<LedgerView, 'walletsById' | 'transactionsById'>,
  ctx: PlanContext,
): Planned<{ id: string }[]> {
  return combine(ids.map((id) => planTransactionEdit(id, data, view, ctx)));
}

/** Add a place: pins expenses that have none to one of the user's places, where its payments sit. */
export function planAddPlace(
  ids: readonly string[],
  place: Place,
  view: Pick<LedgerView, 'walletsById' | 'transactionsById'>,
  ctx: PlanContext,
): Planned<{ id: string }[]> {
  if (!ids.length) return refused('Pick an expense first.');
  const { latitude, longitude, locationName, placeId } = placeLocation(place);
  return planTransactionsEdit(
    ids,
    { locationLatitude: latitude, locationLongitude: longitude, locationName, ...(placeId ? { placeId } : {}) },
    view,
    ctx,
  );
}

export function planTransactionsDelete(ids: readonly string[], ctx: Pick<PlanContext, 'now'>): Planned<null> {
  return planned({ softDelete: ids.map((id) => ({ table: 'transactions' as const, id, at: ctx.now })) }, null);
}
