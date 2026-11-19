import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@repo/types/database';

/** The Supabase client both apps hand in: the Expo client on the phone, `@supabase/ssr`'s on the web. */
export type MoniSupabase = SupabaseClient<Database>;

/** Offline, or the request never got an answer: the browser says "Failed to fetch", React Native "Network request failed". */
export function isNetworkError(message: string | undefined): boolean {
  return !!message && /Failed to fetch|Network request failed/.test(message);
}
