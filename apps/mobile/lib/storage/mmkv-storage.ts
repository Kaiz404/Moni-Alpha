import { createMMKV } from 'react-native-mmkv'

/**
 * MMKV-backed storage adapter for Supabase Auth.
 * Implements the key-value interface using react-native-mmkv.
 */
const storage = createMMKV({ id: 'supabase-auth' });

export const mmkvStorage = {
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