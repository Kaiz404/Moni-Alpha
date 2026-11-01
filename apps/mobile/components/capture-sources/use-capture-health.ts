import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { listGaveUp } from '@/lib/ai/processing-queue';
import {
  readCaptureHealth,
  unreachedCounts,
  type CaptureHealth,
  type UnreachedCounts,
} from '@/lib/notifications/capture-health';
import { onCaptureStatusChanged } from '@/lib/notifications/capture-status';

function readUnreached(): UnreachedCounts {
  return unreachedCounts(listGaveUp());
}

/** MMKV is not observable and the headless task writes behind the UI, so read on the way in. */
export function useCaptureHealth(): {
  health: CaptureHealth;
  unreached: UnreachedCounts;
  refresh: () => void;
} {
  const [health, setHealth] = useState(readCaptureHealth);
  const [unreached, setUnreached] = useState(readUnreached);
  const refresh = useCallback(() => {
    setHealth(readCaptureHealth());
    setUnreached(readUnreached());
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const stopListening = onCaptureStatusChanged(refresh);
    return () => {
      sub.remove();
      stopListening();
    };
  }, [refresh]);

  return { health, unreached, refresh };
}
