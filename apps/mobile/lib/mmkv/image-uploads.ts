import { createMMKV } from 'react-native-mmkv';

/** MMKV instance for offline receipt upload queue (`moni-image-uploads`). */
export const imageUploadMMKV = createMMKV({
  id: 'moni-image-uploads',
});
