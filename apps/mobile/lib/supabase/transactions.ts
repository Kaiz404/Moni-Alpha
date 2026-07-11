import { transactions$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';
import type { CreateTransaction, UpdateTransaction } from '@repo/types';
import { updateTransactionSchema } from '@repo/types';
import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';

type TransactionRow = {
  id: string;
  user_id: string | null;
  wallet_id: string | null;
  amount: string | number | null;
  type: string | null;
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
    amount: parseFloat(String(t.amount ?? '0')),
    type: t.type,
    categoryId: t.category_id,
    transferToWalletId: t.transfer_to_wallet_id,
    linkedTransactionId: t.linked_transaction_id,
    description: t.description,
    merchant: t.merchant,
    notes: t.notes,
    transactionDate: toDateSortKey(t.transaction_date) || toDateSortKey(t.created_at),
    locationLatitude: t.location_latitude != null ? parseFloat(String(t.location_latitude)) : null,
    locationLongitude: t.location_longitude != null ? parseFloat(String(t.location_longitude)) : null,
    locationName: t.location_name,
    receiptImageUrl: t.receipt_image_url,
    metadata,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

export async function getTransactions(walletId?: string, limit: number = 100) {
  let rows = getRecordValues<TransactionRow>(transactions$);

  if (walletId) {
    rows = rows.filter((t) => t.wallet_id === walletId);
  }

  rows.sort((a, b) => toDateSortKey(b.transaction_date).localeCompare(toDateSortKey(a.transaction_date)));

  return rows.slice(0, limit).map(mapTransactionRow);
}

export async function getTransactionById(id: string) {
  const t = getRecordValues<TransactionRow>(transactions$).find((row) => row.id === id);
  if (!t) return null;
  return mapTransactionRow(t);
}

export async function updateTransaction(id: string, data: UpdateTransaction) {
  const parsed = updateTransactionSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid update');
  }

  const p = parsed.data;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (p.walletId !== undefined) patch.wallet_id = p.walletId;
  if (p.amount !== undefined) patch.amount = p.amount;
  if (p.type !== undefined) patch.type = p.type;
  if (p.categoryId !== undefined) patch.category_id = p.categoryId;
  if (p.description !== undefined) patch.description = p.description;
  if (p.merchant !== undefined) patch.merchant = p.merchant;
  if (p.notes !== undefined) patch.notes = p.notes;
  if (p.transactionDate !== undefined) patch.transaction_date = p.transactionDate;
  if (p.locationLatitude !== undefined) patch.location_latitude = p.locationLatitude;
  if (p.locationLongitude !== undefined) patch.location_longitude = p.locationLongitude;
  if (p.locationName !== undefined) patch.location_name = p.locationName;

  patchRow(transactions$, id, patch);

  return getTransactionById(id);
}

export async function createTransaction(data: CreateTransaction) {
  const userId = await getUserId();
  if (!userId) throw new Error('User ID required');

  let resolvedLocationLatitude = data.locationLatitude ?? null;
  let resolvedLocationLongitude = data.locationLongitude ?? null;
  let resolvedLocationName = data.locationName ?? null;

  const shouldCaptureLocation =
    resolvedLocationLatitude === null ||
    resolvedLocationLatitude === undefined ||
    resolvedLocationLongitude === null ||
    resolvedLocationLongitude === undefined;

  if (shouldCaptureLocation) {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        resolvedLocationLatitude = current.coords.latitude;
        resolvedLocationLongitude = current.coords.longitude;

        if (!resolvedLocationName) {
          try {
            const addresses = await Location.reverseGeocodeAsync({
              latitude: current.coords.latitude,
              longitude: current.coords.longitude,
            });
            const first = addresses[0];
            if (first) {
              resolvedLocationName =
                [first.name, first.street, first.city, first.region]
                  .filter(Boolean)
                  .join(', ')
                  .trim() || null;
            }
          } catch {
            // ignore geocode errors
          }
        }
      }
    } catch {
      // ignore location errors
    }
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  transactions$[id].set({
    id,
    user_id: userId,
    wallet_id: data.walletId,
    amount: data.amount,
    type: data.type,
    category_id: data.categoryId || null,
    transfer_to_wallet_id: data.transferToWalletId || null,
    linked_transaction_id: null,
    description: data.description || null,
    merchant: data.merchant || null,
    notes: data.notes || null,
    transaction_date: data.transactionDate || now,
    location_latitude: resolvedLocationLatitude,
    location_longitude: resolvedLocationLongitude,
    location_name: resolvedLocationName || null,
    receipt_image_url: null,
    metadata: {},
    deleted: false,
    created_at: now,
    updated_at: now,
  });

  const result = await getTransactionById(id);
  if (!result) throw new Error('Failed to create transaction');
  return result;
}

export async function deleteTransaction(id: string) {
  patchRow(transactions$, id, {
    deleted: true,
    updated_at: new Date().toISOString(),
  });
}
