import { observable } from '@legendapp/state';
import { supabase } from '@/lib/supabase/client';

/** True when Supabase has an authenticated user and sync observers are active. */
export const authReady$ = observable(false);

let bound = false;

/**
 * Clear authReady$ as soon as the session ends.
 * StoreSyncActivator sets it true after observers are registered on sign-in.
 */
export function initAuthReadySync(): void {
  if (bound) return;
  bound = true;

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.user) authReady$.set(false);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) authReady$.set(false);
  });
}
