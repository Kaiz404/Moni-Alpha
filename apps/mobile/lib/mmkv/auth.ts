import { createMMKV } from 'react-native-mmkv';

/** MMKV instance for Supabase Auth session tokens (`supabase-auth`). */
const storage = createMMKV({ id: 'supabase-auth' });

/** Async key-value adapter required by `@supabase/supabase-js` auth storage. */
export const authMMKV = {
  async getItem(key: string): Promise<string | null> {
    return storage.getString(key) ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    storage.set(key, value);
  },

  async removeItem(key: string): Promise<void> {
    storage.remove(key);
  },
};
