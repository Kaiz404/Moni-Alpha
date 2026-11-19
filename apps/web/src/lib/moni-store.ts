import { createMoniStore, memoryPersist, type MoniStore, type MoniSupabase } from '@repo/data';
import { createClient } from '@/lib/supabase/client';

/** The web's adapters: the session in cookies through `@supabase/ssr`, and rows in memory (IndexedDB later). */
export function createWebStore(supabase: MoniSupabase): MoniStore {
  return createMoniStore({ supabase, persist: memoryPersist(), uuid: () => crypto.randomUUID() });
}

let store: MoniStore | null = null;

/** One store per tab, made the first time the browser asks; realtime keeps tabs in step. */
export function moniStore(): MoniStore {
  store ??= createWebStore(createClient());
  return store;
}
