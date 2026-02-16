import { supabase } from '@/lib/supabase/client';
import { getWalletBalances } from '@/lib/supabase/balances';
import type { CreateWallet } from '@repo/types';

export async function getWallets() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;

  // Get current balances for all wallets
  const walletIds = (data || []).map(w => w.id);
  const balances = await getWalletBalances(walletIds);

  return (data || []).map(w => ({
    id: w.id,
    userId: w.user_id,
    name: w.name,
    type: w.type,
    currency: w.currency,
    initialBalance: parseFloat(w.initial_balance),
    currentBalance: balances[w.id] || parseFloat(w.initial_balance),
    color: w.color,
    icon: w.icon,
    isActive: w.is_active,
    displayOrder: w.display_order,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  }));
}

export async function createWallet(data: CreateWallet) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: result, error } = await supabase
    .from('wallets')
    .insert({
      user_id: user.id,
      name: data.name,
      type: data.type,
      currency: data.currency ?? 'USD',
      initial_balance: data.initialBalance ?? 0,
      color: data.color,
      icon: data.icon,
      display_order: 0,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: result.id,
    userId: result.user_id,
    name: result.name,
    type: result.type,
    currency: result.currency,
    initialBalance: parseFloat(result.initial_balance),
    color: result.color,
    icon: result.icon,
    isActive: result.is_active,
    displayOrder: result.display_order,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function updateWallet(id: string, data: Partial<CreateWallet>) {
  const { data: result, error } = await supabase
    .from('wallets')
    .update({
      ...data,
      initial_balance: data.initialBalance,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: result.id,
    userId: result.user_id,
    name: result.name,
    type: result.type,
    currency: result.currency,
    initialBalance: parseFloat(result.initial_balance),
    color: result.color,
    icon: result.icon,
    isActive: result.is_active,
    displayOrder: result.display_order,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function deleteWallet(id: string) {
  const { error } = await supabase
    .from('wallets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}