import { syncSystem } from '@/lib/powersync/Powersync';
import { getWalletBalances } from '@/lib/supabase/balances';
import type { CreateWallet } from '@repo/types';
import { randomUUID } from 'expo-crypto';

export async function getWallets() {
  const { db, supabaseConnector } = syncSystem;

  const userId = await supabaseConnector.getUserId()

  if (!userId) throw new Error('User ID required');

  const wallets = await db
    .selectFrom('wallets')
    .selectAll()
    .where('user_id', '=', userId)
    .where('is_active', '=', 1)
    .orderBy('display_order', 'asc')
    .execute();

  // Get current balances for all wallets
  const walletIds = wallets.map(w => w.id);
  const balances = await getWalletBalances(walletIds);

  return wallets.map(w => ({
    id: w.id,
    userId: w.user_id,
    name: w.name,
    type: w.type,
    currency: w.currency,
    initialBalance: parseFloat(w.initial_balance || '0'),
    currentBalance: balances[w.id] || parseFloat(w.initial_balance || '0'),
    color: w.color,
    icon: w.icon,
    isActive: w.is_active,
    displayOrder: w.display_order,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  }));
}

export async function getWalletById(id: string) {
  const { db, supabaseConnector } = syncSystem;

  const userId = await supabaseConnector.getUserId();
  if (!userId) throw new Error('User ID required');

  const w = await db
    .selectFrom('wallets')
    .selectAll()
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!w) return null;

  const balances = await getWalletBalances([w.id]);

  return {
    id: w.id,
    userId: w.user_id,
    name: w.name ?? '',
    type: w.type,
    currency: w.currency,
    initialBalance: parseFloat(w.initial_balance || '0'),
    currentBalance: balances[w.id] ?? parseFloat(w.initial_balance || '0'),
    color: w.color,
    icon: w.icon,
    isActive: w.is_active === 1,
    displayOrder: w.display_order,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export async function createWallet(data: CreateWallet) {
  const { db, supabaseConnector } = syncSystem;

  const userId = await supabaseConnector.getUserId()

  if (!userId) throw new Error('User ID required');

  const id = randomUUID();

  const result = await db
    .insertInto('wallets')
    .values({
      id,
      user_id: userId,
      name: data.name,
      type: data.type,
      currency: data.currency ?? 'USD',
      initial_balance: (data.initialBalance ?? 0).toString(),
      color: data.color,
      icon: data.icon,
      is_active: 1,
      display_order: 0,
    })
    .returningAll()
    .executeTakeFirst();

  if (!result) throw new Error('Failed to create wallet');

  return {
    id: result.id,
    userId: result.user_id,
    name: result.name,
    type: result.type,
    currency: result.currency,
    initialBalance: parseFloat(result.initial_balance || '0'),
    color: result.color,
    icon: result.icon,
    isActive: result.is_active,
    displayOrder: result.display_order,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function updateWallet(id: string, data: Partial<CreateWallet>) {
  const { db } = syncSystem;

  const set: Record<string, string | number> = {
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) set.name = data.name;
  if (data.type !== undefined) set.type = data.type;
  if (data.currency !== undefined) set.currency = data.currency;
  if (data.color !== undefined) set.color = data.color;
  if (data.icon !== undefined) set.icon = data.icon;
  if (data.initialBalance !== undefined) {
    set.initial_balance = data.initialBalance.toString();
  }

  const result = await db
    .updateTable('wallets')
    .set(set)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  if (!result) throw new Error('Failed to update wallet');

  return {
    id: result.id,
    userId: result.user_id,
    name: result.name,
    type: result.type,
    currency: result.currency,
    initialBalance: parseFloat(result.initial_balance || '0'),
    color: result.color,
    icon: result.icon,
    isActive: result.is_active === 1,
    displayOrder: result.display_order,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function deleteWallet(id: string) {
  const { db } = syncSystem;

  // Remove all transactions related to this wallet first so the wallet delete
  // doesn't violate FK constraints during remote sync.
  await db
    .deleteFrom('transactions')
    .where((eb) =>
      eb.or([
        eb('wallet_id', '=', id),
      ])
    )
    .execute();

  await db
    .deleteFrom('wallets')
    .where('id', '=', id)
    .execute();
}