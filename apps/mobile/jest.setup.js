process.env.EXPO_PUBLIC_SUPABASE_URL ??=
  'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??=
  'sb_publishable_test';

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
      remove: (key) => storage.delete(key),
      getAllKeys: () => [...storage.keys()],
      clearAll: () => {
        storage.clear();
      },
    };
  }),
}));

// Reanimated's mock leaves these out; Press reads useReducedMotion and InPlaceField renders the config.
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock'),
);
// The mock's useSharedValue makes a new value each render; a device keeps one for the component's life.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useSharedValue: (init) =>
    require('react').useState(() => require('react-native-reanimated/mock').useSharedValue(init))[0],
  useReducedMotion: () => false,
  LayoutAnimationConfig: ({ children }) => children,
}));
