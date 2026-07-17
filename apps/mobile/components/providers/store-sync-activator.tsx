import { useEffect } from 'react';
import { observe } from '@legendapp/state';
import { useAuth } from '@/lib/auth/auth-context';
import { authReady$ } from '@/lib/store/auth-sync';
import {
  ALL_STORE_OBSERVABLES,
  enableStoreSync,
  wallets$,
} from '@/lib/store';
import { startFinanceProjection } from '@/lib/finance/projection';
import { repairFinanceIntegrity } from '@/lib/finance/integrity';
import { reconcileDebtTransactions } from '@/lib/supabase/debts';
import { refreshLinkedPackagesFromStore } from '@/lib/notifications/linked-packages-cache';
import { syncDefaultWalletFromProfile } from '@/lib/wallets/default-wallet';

/**
 * Keeps synced table roots observed (required for Legend-State remote sync)
 * and triggers a Supabase pull whenever the signed-in user changes.
 */
export function StoreSyncActivator() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let stopProjection: (() => void) | undefined;
    let cancelled = false;

    // Observe roots before enabling sync so Legend-State does not skip remote I/O.
    const disposers = ALL_STORE_OBSERVABLES.map((obs$) =>
      observe(() => {
        obs$.get();
      }),
    );

    authReady$.set(true);
    void enableStoreSync({ fullReset: true })
      .then(() => {
        if (cancelled) return;
        stopProjection = startFinanceProjection();
        repairFinanceIntegrity();
        // A previous offline write may have made the debt activity before its cash
        // mirror. This is a post-sync repair, never a read-side effect.
        void reconcileDebtTransactions().catch(() => {});
      })
      .catch(() => {});
    refreshLinkedPackagesFromStore();
    void syncDefaultWalletFromProfile().catch(() => {});

    const walletsDispose = observe(() => {
      wallets$.get();
      refreshLinkedPackagesFromStore();
    });

    return () => {
      cancelled = true;
      stopProjection?.();
      walletsDispose();
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [userId]);

  return null;
}
