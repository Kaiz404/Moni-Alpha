import { useNetworkState } from 'expo-network';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { startBackgroundProcessor } from '@/lib/ai/background-processor';

function retry() {
  startBackgroundProcessor().catch(() => {});
}

/**
 * Queued captures, including ones the headless task took, retry when the app opens, when it
 * returns to the foreground, and when the phone comes back online.
 */
export function useCaptureRetry() {
  const { isConnected, isInternetReachable } = useNetworkState();
  const online = isConnected !== false && isInternetReachable !== false;
  const wasOnline = useRef(online);

  useEffect(() => {
    if (online && !wasOnline.current) retry();
    wasOnline.current = online;
  }, [online]);

  useEffect(() => {
    retry();
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (previous !== 'active' && next === 'active') retry();
      previous = next;
    });
    return () => sub.remove();
  }, []);
}
