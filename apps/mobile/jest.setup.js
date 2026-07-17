process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'sb_publishable_test';

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => {
    const storage = new Map();
    return {
      set: (key, value) => {
        storage.set(key, String(value));
      },
      getString: (key) => storage.get(key),
      getNumber: (key) => Number(storage.get(key)),
      getBoolean: (key) => storage.get(key) === 'true',
      contains: (key) => storage.has(key),
      delete: (key) => {
        storage.delete(key);
      },
      getAllKeys: () => [...storage.keys()],
      clearAll: () => {
        storage.clear();
      },
    };
  }),
}));
