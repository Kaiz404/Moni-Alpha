import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { readCaptureHealth, type CaptureHealth } from '@/lib/notifications/capture-health';

/** MMKV is not observable and the headless task writes behind the UI, so read on the way in. */
export function useCaptureHealth(): { health: CaptureHealth; refresh: () => void } {
  const [health, setHealth] = useState(readCaptureHealth);
  const refresh = useCallback(() => setHealth(readCaptureHealth()), []);

  useFocusEffect(refresh);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { health, refresh };
}
