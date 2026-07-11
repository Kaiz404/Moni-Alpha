import { useEffect } from 'react';
import { observe } from '@legendapp/state';
import { useAuth } from '@/lib/auth/auth-context';
import { authReady$ } from '@/lib/store/auth-sync';
import { ALL_STORE_OBSERVABLES, enableStoreSync } from '@/lib/store';

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

    return () => {
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [user?.id]);

  return null;
}
