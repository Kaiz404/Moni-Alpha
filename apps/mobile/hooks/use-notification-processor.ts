/**
 * Drains the `pending_ai_queue` MMKV list (filled by the headless notification
 * task) by running each notification through the on-device AI and saving
 * any detected transactions as ProposedTransactions in PowerSync.
 *
 * Processing is intentionally lazy — it runs when the user opens the
 * Notifications tab — so it never competes with foreground UI work.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import {
  downloadNotificationModel,
  getOrLoadChatModelFallback,
  getOrLoadNotificationModel,
  isNotificationModelDownloaded,
  NOTIFICATION_MODEL_ID,
  type RawNotification,
} from '@/lib/ai/notification-processor';
import { runNotificationOrchestration } from '@/lib/ai/notification-orchestrator';

const PENDING_AI_KEY = 'pending_ai_queue';
const notificationStorage = createMMKV({ id: 'moni-notifications' });

export type ProcessorModelStatus =
  | 'idle'
  | 'not-downloaded'
  | 'downloading'
  | 'ready'
  | 'unavailable';

function readPendingQueue(): RawNotification[] {
  try {
    const raw = notificationStorage.getString(PENDING_AI_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function clearPendingQueue() {
  notificationStorage.remove(PENDING_AI_KEY);
}

function removeProcessed(processedIds: Set<string>) {
  const remaining = readPendingQueue().filter((n) => !processedIds.has(n.id));
  notificationStorage.set(PENDING_AI_KEY, JSON.stringify(remaining));
}

export function useNotificationProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [modelStatus, setModelStatus] = useState<ProcessorModelStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const processingRef = useRef(false);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(readPendingQueue().length);
  }, []);

  const checkModelStatus = useCallback(async () => {
    const downloaded = await isNotificationModelDownloaded();
    setModelStatus(downloaded ? 'ready' : 'not-downloaded');
    return downloaded;
  }, []);

  const downloadModel = useCallback(async () => {
    setModelStatus('downloading');
    setDownloadProgress(0);
    try {
      await downloadNotificationModel((pct) => setDownloadProgress(pct));
      setModelStatus('ready');
    } catch {
      setModelStatus('not-downloaded');
    }
  }, []);

  /**
   * Process every item in the pending queue.
   * Tries notification model first; falls back to chat model.
   */
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;

    const queue = readPendingQueue();
    if (queue.length === 0) {
      setPendingCount(0);
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    setPendingCount(queue.length);

    try {
      // Resolve model — prefer small notification model, fall back to chat model
      let model = await getOrLoadNotificationModel();
      if (!model) {
        model = await getOrLoadChatModelFallback();
      }
      if (!model) {
        setModelStatus('unavailable');
        return;
      }

      const processedIds = new Set<string>();
      let newProposals = 0;

      for (const notification of queue) {
        try {
          const result = await runNotificationOrchestration(model, notification, {
            trace: (event) => {
              const details = event.details ? JSON.stringify(event.details) : '';
              console.log(
                '[Processor/Trace]',
                `${event.stage}.${event.event}`,
                details,
              );
            },
          });
          if (result.created) {
            newProposals++;
          } else {
            console.log('[Processor] Notification skipped:', result.reason);
          }

          processedIds.add(notification.id);
        } catch {
          // Skip this notification and continue with the rest
        }
      }

      removeProcessed(processedIds);
      setProcessedCount((c) => c + processedIds.size);
      setPendingCount(readPendingQueue().length);

      if (newProposals > 0) {
        console.log(`[Processor] Created ${newProposals} transaction proposal(s)`);
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, []);

  // Check model status and pending count on mount
  useEffect(() => {
    checkModelStatus();
    refreshPendingCount();
  }, [checkModelStatus, refreshPendingCount]);

  // Re-check when app comes back to foreground
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
    modelStatus,
    downloadProgress,
    notificationModelId: NOTIFICATION_MODEL_ID,
    processQueue,
    downloadModel,
    checkModelStatus,
    refreshPendingCount,
    clearPendingQueue,
  };
}
