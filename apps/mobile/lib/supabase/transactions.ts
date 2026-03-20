import { syncSystem } from '@/lib/powersync/Powersync';
import type { CreateTransaction } from '@repo/types';
import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';

export async function getTransactions(walletId?: string) {
  const { db } = syncSystem;

  let query = db
    .selectFrom('transactions')
    .selectAll()
    .orderBy('transaction_date', 'desc');

  if (walletId) {
    query = query.where('wallet_id', '=', walletId);
  }

  const transactions = await query.execute();

  return transactions.map(t => ({
    id: t.id,
    userId: t.user_id,
    walletId: t.wallet_id,
    amount: parseFloat(t.amount || '0'),
    type: t.type,
    categoryId: t.category_id,
    transferToWalletId: t.transfer_to_wallet_id,
    linkedTransactionId: t.linked_transaction_id,
    description: t.description,
    merchant: t.merchant,
    notes: t.notes,
    transactionDate: t.transaction_date,
    locationLatitude: t.location_latitude ? parseFloat(t.location_latitude) : null,
    locationLongitude: t.location_longitude ? parseFloat(t.location_longitude) : null,
    locationName: t.location_name,
    receiptImageUrl: t.receipt_image_url,
    metadata: t.metadata,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));
}

export async function createTransaction(data: CreateTransaction) {
  const { db, supabaseConnector } = syncSystem;
  
  const userId = await supabaseConnector.getUserId()

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
          }
        }
      }
    } catch {
    }
  }

  const id = randomUUID();

  const result = await db
    .insertInto('transactions')
    .values({
      id,
      user_id: userId,
      wallet_id: data.walletId,
      amount: data.amount.toString(),
      type: data.type,
      category_id: data.categoryId || null,
      transfer_to_wallet_id: data.transferToWalletId || null,
      description: data.description || null,
      merchant: data.merchant || null,
      notes: data.notes || null,
      transaction_date: data.transactionDate || new Date().toISOString(),
      location_latitude:
        resolvedLocationLatitude === undefined || resolvedLocationLatitude === null
          ? null
          : resolvedLocationLatitude.toString(),
      location_longitude:
        resolvedLocationLongitude === undefined || resolvedLocationLongitude === null
          ? null
          : resolvedLocationLongitude.toString(),
      location_name: resolvedLocationName || null,
      metadata: JSON.stringify({}),
    })
    .returningAll()
    .executeTakeFirst();

  if (!result) throw new Error('Failed to create transaction');

  return {
    id: result.id,
    userId: result.user_id,
    walletId: result.wallet_id,
    amount: parseFloat(result.amount || '0'),
    type: result.type,
    categoryId: result.category_id,
    transferToWalletId: result.transfer_to_wallet_id,
    linkedTransactionId: result.linked_transaction_id,
    description: result.description,
    merchant: result.merchant,
    notes: result.notes,
    transactionDate: result.transaction_date,
    locationLatitude: result.location_latitude ? parseFloat(result.location_latitude) : null,
    locationLongitude: result.location_longitude ? parseFloat(result.location_longitude) : null,
    locationName: result.location_name,
    receiptImageUrl: result.receipt_image_url,
    metadata: result.metadata ? JSON.parse(result.metadata) : {},
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function deleteTransaction(id: string) {
  const { db } = syncSystem;

  await db
    .deleteFrom('transactions')
    .where('id', '=', id)
    .execute();
}