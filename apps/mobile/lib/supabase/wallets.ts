import type { StoredRow } from '@repo/core';
import { syncState } from '@legendapp/state';
import { assertMigrated, wallets$ } from '@/lib/store';
import { getRecordValues, isActive, patchRow } from '@/lib/store/helpers';
import { commit, ledgerView, planContext } from '@/lib/store/writes';
import { getUserId } from '@/lib/supabase/client';
import { getWalletBalances } from '@/lib/supabase/balances';
import { recordSourceLinked } from '@/lib/notifications/capture-health';
import { clearDefaultWalletIfDeleted } from '@/lib/wallets/default-wallet';
import { DEFAULT_WALLET_CARD_STYLE_ID } from '@/constants/wallet-card-styles';
import type { CreateWallet, UpdateWallet, MinorAmount } from '@repo/types';
import { decimalToMinor, minorToDecimal } from '@repo/types';
import { nextWalletOrder, planWalletCreate, planWalletDelete, planWalletOrder, toFinanceWallet } from '@repo/core';

type WalletRow = StoredRow<'wallets'>;


/**
 * Whether this process holds the wallet list as Supabase last sent it. Before the first pull, or
 * after one that failed, the phone may not know about a wallet linked elsewhere.
 */
export function walletsArePulled(): boolean {
  const state$ = syncState(wallets$);
  return state$.isLoaded.peek() && !state$.error.peek();
}

/** A wallet as the screens read it: the read model's, with its balance and a card style to draw. */
function walletView(row: WalletRow, currentBalanceMinor?: MinorAmount) {
  const wallet = toFinanceWallet(row);
  if (!wallet) return null;
  return {
    ...wallet,
    cardStyleId: wallet.cardStyleId ?? DEFAULT_WALLET_CARD_STYLE_ID,
    currentBalanceMinor: currentBalanceMinor ?? wallet.initialBalanceMinor,
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

  return wallets.flatMap((w) => walletView(w, balances[w.id]) ?? []);
}

export async function getWalletById(id: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('User ID required');

  const w = getRecordValues<WalletRow>(wallets$).find(
    (row) => row.id === id && row.user_id === userId,
  );
  if (!w) return null;

  const balances = await getWalletBalances([w.id]);
  return walletView(w, balances[w.id]);
}

export async function createWallet(data: CreateWallet) {
  const id = commit(planWalletCreate(data, await planContext(), nextWalletOrder(ledgerView())));

  if (data.notificationPackage) recordSourceLinked(data.notificationPackage);

  const created = getRecordValues<WalletRow>(wallets$).find((w) => w.id === id);
  if (!created) throw new Error('Failed to create wallet');

  return walletView(created);
}

export async function updateWallet(id: string, data: UpdateWallet) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };

  if (data.name !== undefined) patch.name = data.name;
  if (data.type !== undefined) patch.type = data.type;
  if (data.currency !== undefined) patch.currency = data.currency;
  if (data.color !== undefined) patch.color = data.color;
  if (data.icon !== undefined) patch.icon = data.icon;
  if (data.cardStyleId !== undefined) patch.card_style_id = data.cardStyleId;
  if (data.initialBalanceMinor !== undefined)
    patch.initial_balance = minorToDecimal(data.initialBalanceMinor);
  if (data.notificationPackage !== undefined) patch.notification_package = data.notificationPackage;
  if (data.notificationAppLabel !== undefined)
    patch.notification_app_label = data.notificationAppLabel;
  if (data.notificationAccountHint !== undefined) {
    patch.notification_account_hint = data.notificationAccountHint;
  }
  if (data.balanceConfirmedAt !== undefined) patch.balance_confirmed_at = data.balanceConfirmedAt;
  if (data.recordLocation !== undefined) {
    // Before the migration, an unknown column would fail every later sync of this wallet row.
    assertMigrated('merchant_aliases_and_wallet_location');
    patch.record_location = data.recordLocation;
  }

  const before = getRecordValues<WalletRow>(wallets$).find((w) => w.id === id);
  if (data.notificationPackage && data.notificationPackage !== before?.notification_package) {
    recordSourceLinked(data.notificationPackage, now);
  }
  patchRow(wallets$, id, patch);

  const updated = getRecordValues<WalletRow>(wallets$).find((w) => w.id === id);
  if (!updated) throw new Error('Failed to update wallet');

  return walletView(updated);
}

/** The user saw this wallet's balance and says it is still right. Undo passes back the earlier time. */
export function confirmWalletBalance(id: string, at: string | null = new Date().toISOString()): void {
  patchRow(wallets$, id, { balance_confirmed_at: at, updated_at: new Date().toISOString() });
}

/** One order for Home's strip and Wallets: every wallet's id, main currency first. */
export function reorderWallets(order: readonly string[]): void {
  commit(planWalletOrder(order, ledgerView(), { now: new Date().toISOString() }));
}

export async function deleteWallet(id: string) {
  commit(planWalletDelete(id, ledgerView(), { now: new Date().toISOString() }));
  await clearDefaultWalletIfDeleted(id);
}
