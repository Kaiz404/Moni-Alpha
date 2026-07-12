import { useEffect } from 'react';
import { observe } from '@legendapp/state';
import { useAuth } from '@/lib/auth/auth-context';
import { authReady$ } from '@/lib/store/auth-sync';
import { ALL_STORE_OBSERVABLES, enableStoreSync, wallets$ } from '@/lib/store';
import { refreshLinkedPackagesFromStore } from '@/lib/notifications/linked-packages-cache';

/**
 * Keeps synced table roots observed (required for Legend-State remote sync)
 * and triggers a Supabase pull whenever the signed-in user changes.
 */
export function StoreSyncActivator() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Observe roots before enabling sync so Legend-State does not skip remote I/O.
    const disposers = ALL_STORE_OBSERVABLES.map((obs$) =>
      observe(() => {
        obs$.get();
      }),
    );

    authReady$.set(true);
    void enableStoreSync({ fullReset: true });
    refreshLinkedPackagesFromStore();

    const walletsDispose = observe(() => {
      wallets$.get();
      refreshLinkedPackagesFromStore();
    });

    return () => {
      walletsDispose();
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [user?.id]);

  return null;
}
