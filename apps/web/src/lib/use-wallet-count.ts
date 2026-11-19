'use client';

import { syncState } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import { toFinanceWallet } from '@repo/core';
import { moniStore } from '@/lib/moni-store';

/** How many active wallets the user has, from the shared store's read model; null until the first pull lands. */
export function useWalletCount(): number | null {
  return useValue(() => {
    // The server renders the shell only; the ledger lives in the browser.
    if (typeof window === 'undefined') return null;
    const wallets$ = moniStore().wallets$;
    if (!syncState(wallets$).isLoaded.get()) return null;
    return Object.values(wallets$.get() ?? {}).filter((row) => toFinanceWallet(row)?.isActive).length;
  });
}
