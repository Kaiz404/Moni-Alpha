import { observable } from '@legendapp/state';
import { supabase } from '@/lib/supabase/client';

/** True when Supabase has an authenticated user — gates Legend-State sync read/write. */
export const authReady$ = observable(false);

let bound = false;

export function initStoreAuthSync(onSignedIn: () => void): void {
  if (bound) return;
  bound = true;

  supabase.auth.getSession().then(({ data: { session } }) => {
    const ready = Boolean(session?.user);
    authReady$.set(ready);
    if (ready) onSignedIn();
  });

  supabase.auth.onAuthStateChange((event, session) => {
    authReady$.set(Boolean(session?.user));
    if (event === 'SIGNED_IN') {
      onSignedIn();
    }
  });
}
