import { preferencesMMKV } from '@/lib/mmkv/preferences';
import {
  getProfilePreferences,
  updateProfilePreferences,
} from '@/lib/supabase/profile';

export const DEFAULT_WALLET_ID_KEY = 'default-wallet-id';

/** Local cache for fast reads (background extraction). Source of truth is profiles.preferences. */
export function cacheDefaultWalletId(walletId: string | null): void {
  if (walletId) {
    preferencesMMKV.set(DEFAULT_WALLET_ID_KEY, walletId);
  } else {
    preferencesMMKV.remove(DEFAULT_WALLET_ID_KEY);
  }
}

export function clearDefaultWalletCache(): void {
  preferencesMMKV.remove(DEFAULT_WALLET_ID_KEY);
}

export function getDefaultWalletId(): string | null {
  return preferencesMMKV.getString(DEFAULT_WALLET_ID_KEY) ?? null;
}

/** Pull default wallet from Supabase profile and refresh the local cache. */
export async function syncDefaultWalletFromProfile(): Promise<string | null> {
  const prefs = await getProfilePreferences();
  const id = prefs.default_wallet_id ?? null;
  cacheDefaultWalletId(id);
  return id;
}

export async function setDefaultWalletId(walletId: string | null): Promise<void> {
  cacheDefaultWalletId(walletId);
  await updateProfilePreferences({ default_wallet_id: walletId });
}

/** Returns stored id only when it still exists in the given wallet list. */
export function resolveDefaultWalletId(
  wallets: readonly { id: string }[],
  storedId: string | null = getDefaultWalletId(),
): string | null {
  if (!storedId) return null;
  return wallets.some((w) => w.id === storedId) ? storedId : null;
}

export async function clearDefaultWalletIfDeleted(walletId: string): Promise<void> {
  if (getDefaultWalletId() === walletId) {
    await setDefaultWalletId(null);
  }
}
