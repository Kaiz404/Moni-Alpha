import { createMMKV } from 'react-native-mmkv';
import { observablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv';

/** MMKV instance for Legend-State synced table cache (`legend-store`). */
export const legendMMKV = createMMKV({ id: 'legend-store' });

export const legendPersistPlugin = observablePersistMMKV({ id: 'legend-store' });
