import {
  wallets$,
  transactions$,
} from '@/lib/store';
import { getRecordValues, isActive, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';
import { getWalletBalances } from '@/lib/supabase/balances';
import { refreshLinkedPackagesFromStore } from '@/lib/notifications/linked-packages-cache';
import { clearDefaultWalletIfDeleted } from '@/lib/wallets/default-wallet';
import type { CreateWallet, UpdateWallet } from '@repo/types';
import { randomUUID } from 'expo-crypto';

type WalletRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  type: string | null;
  currency: string | null;
  initial_balance: string | number | null;
  color: string | null;
  icon: string | null;
  is_active: boolean | number | null;
  display_order: number | null;
  notification_package: string | null;
  notification_app_label: string | null;
  notification_account_hint: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted?: boolean;
};

function mapWalletRow(w: WalletRow, currentBalance?: number) {
  const initial = parseFloat(String(w.initial_balance ?? '0'));
  return {
    id: w.id,
    userId: w.user_id ?? '',
    name: w.name ?? '',
    type: w.type,
    currency: w.currency,
    initialBalance: initial,
    currentBalance: currentBalance ?? initial,
    color: w.color,
    icon: w.icon,
    isActive: isActive(w.is_active),
    displayOrder: w.display_order ?? 0,
    notificationPackage: w.notification_package ?? null,
    notificationAppLabel: w.notification_app_label ?? null,
    notificationAccountHint: w.notification_account_hint ?? null,
    createdAt: w.created_at ?? w.updated_at ?? '',
    updatedAt: w.updated_at ?? w.created_at ?? '',
  };
}

export async function getWallets() {
  const userId = await getUserId();
  if (!userId) throw new Error('User ID required');

  const wallets = getRecordValues<WalletRow>(wallets$)
    .filter((w) => w.user_id === userId && isActive(w.is_active))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  const walletIds = wallets.map((w) => w.id);
  const balances = await getWalletBalances(walletIds);

  return wallets.map((w) => mapWalletRow(w, balances[w.id] ?? parseFloat(String(w.initial_balance ?? '0'))));
}

export async function getWalletById(id: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('User ID required');

  const w = getRecordValues<WalletRow>(wallets$).find(
    (row) => row.id === id && row.user_id === userId,
  );
  if (!w) return null;

  const balances = await getWalletBalances([w.id]);
  return mapWalletRow(w, balances[w.id] ?? parseFloat(String(w.initial_balance ?? '0')));
}

export async function createWallet(data: CreateWallet) {
  const userId = await getUserId();
  if (!userId) throw new Error('User ID required');

  const id = randomUUID();

  wallets$[id].set({
    id,
    user_id: userId,
    name: data.name,
    type: data.type,
    currency: data.currency ?? 'USD',
    initial_balance: data.initialBalance ?? 0,
    color: data.color,
    icon: data.icon,
    notification_package: data.notificationPackage ?? null,
    notification_app_label: data.notificationAppLabel ?? null,
    notification_account_hint: data.notificationAccountHint ?? null,
    is_active: true,
    display_order: 0,
    deleted: false,
  });

  refreshLinkedPackagesFromStore();

  const created = getRecordValues<WalletRow>(wallets$).find((w) => w.id === id);
  if (!created) throw new Error('Failed to create wallet');

  return mapWalletRow(created);
}

export async function updateWallet(id: string, data: UpdateWallet) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };

  if (data.name !== undefined) patch.name = data.name;
  if (data.type !== undefined) patch.type = data.type;
  if (data.currency !== undefined) patch.currency = data.currency;
  if (data.color !== undefined) patch.color = data.color;
  if (data.icon !== undefined) patch.icon = data.icon;
  if (data.initialBalance !== undefined) patch.initial_balance = data.initialBalance;
  if (data.notificationPackage !== undefined) patch.notification_package = data.notificationPackage;
  if (data.notificationAppLabel !== undefined) patch.notification_app_label = data.notificationAppLabel;
  if (data.notificationAccountHint !== undefined) {
    patch.notification_account_hint = data.notificationAccountHint;
  }

  patchRow(wallets$, id, patch);
  refreshLinkedPackagesFromStore();

  const updated = getRecordValues<WalletRow>(wallets$).find((w) => w.id === id);
  if (!updated) throw new Error('Failed to update wallet');

  return mapWalletRow(updated);
}

export async function deleteWallet(id: string) {
  const now = new Date().toISOString();

  for (const tx of getRecordValues<{ id: string; wallet_id: string | null }>(transactions$)) {
    if (tx.wallet_id === id) {
      patchRow(transactions$, tx.id, { deleted: true, updated_at: now });
    }
  }

  patchRow(wallets$, id, { deleted: true, updated_at: now });
  await clearDefaultWalletIfDeleted(id);
  refreshLinkedPackagesFromStore();
}
