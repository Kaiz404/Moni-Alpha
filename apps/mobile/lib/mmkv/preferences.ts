import { createMMKV } from 'react-native-mmkv';

/** MMKV instance for local UI preferences (theme, etc.). */
export const preferencesMMKV = createMMKV({ id: 'moni-preferences' });
