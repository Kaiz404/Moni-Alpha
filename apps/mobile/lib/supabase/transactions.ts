import { supabase } from '@/lib/supabase/client';
import type { CreateTransaction } from '@repo/types';

export async function getTransactions(walletId?: string) {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false });

  if (walletId) {
    query = query.eq('wallet_id', walletId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(t => ({
    id: t.id,
    userId: t.user_id,
    walletId: t.wallet_id,
    amount: parseFloat(t.amount),
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: result, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      wallet_id: data.walletId,
      amount: data.amount,
      type: data.type,
      category_id: data.categoryId || null,
      transfer_to_wallet_id: data.transferToWalletId || null,
      description: data.description || null,
      merchant: data.merchant || null,
      notes: data.notes || null,
      transaction_date: data.transactionDate || new Date().toISOString(),
      metadata: {},
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: result.id,
    userId: result.user_id,
    walletId: result.wallet_id,
    amount: parseFloat(result.amount),
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
    metadata: result.metadata,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}