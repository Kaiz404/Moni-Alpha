'use client';

import { observe } from '@legendapp/state';
import { useEffect } from 'react';
import { moniStore } from '@/lib/moni-store';

/**
 * Keeps every synced table observed, which Legend-State needs before it talks to Supabase, and pulls
 * the ledger once a user is signed in. Sync stops the moment the session ends, in this tab or another.
 */
export function StoreSync() {
  useEffect(() => {
    const store = moniStore();
    const disposers = store.all.map((table$) => observe(() => table$.get()));
    const stopWatching = store.watchSession();
    let cancelled = false;
    void store.supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session?.user) return;
      store.authReady$.set(true);
      void store.enableStoreSync({ fullReset: true });
    });
    return () => {
      cancelled = true;
      stopWatching();
      disposers.forEach((dispose) => dispose());
    };
  }, []);
  return null;
}
