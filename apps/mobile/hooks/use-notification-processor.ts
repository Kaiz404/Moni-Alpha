/**
 * Hook for the Notifications tab.
 *
 * Notifications go through the unified processing queue and background
 * processor (AI backend client — mocked until the Go service exists).
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getPendingCount, getAll } from '@/lib/ai/processing-queue';
import {
  startBackgroundProcessor,
  isBackgroundProcessorRunning,
} from '@/lib/ai/background-processor';

export function useNotificationProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    const notifPending = getAll().filter(
      (i) => i.type === 'notification' && (i.status === 'pending' || i.status === 'processing'),
    ).length;
    setPendingCount(notifPending);

    const notifDone = getAll().filter(
      (i) => i.type === 'notification' && i.status === 'done',
    ).length;
    setProcessedCount(notifDone);
  }, []);

  const processQueue = useCallback(async () => {
    if (isBackgroundProcessorRunning()) {
      setIsProcessing(true);
      return;
    }

    const pending = getPendingCount();
    if (pending === 0) {
      setPendingCount(0);
      return;
    }

    setIsProcessing(true);
    try {
      await startBackgroundProcessor();
    } finally {
      setIsProcessing(false);
      refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshPendingCount();
      }
    });
    return () => sub.remove();
  }, [refreshPendingCount]);

  return {
    isProcessing,
    pendingCount,
    processedCount,
    processQueue,
    refreshPendingCount,
    clearPendingQueue: () => {},
  };
}
