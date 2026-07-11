/**
 * Read-only snapshot of the Android notification capture + processing pipeline.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { getAll, peekPending } from '@/lib/ai/processing-queue';
import { isBackgroundProcessorRunning } from '@/lib/ai/background-processor';
import type { PermissionStatus } from '@/hooks/use-notification-listener';
import { readNotificationListenerPermission } from '@/lib/notifications/permission';

const CAPTURED_KEY = 'captured_notifications';
const notificationStorage = createMMKV({ id: 'moni-notifications' });

type StoredNotification = {
  id: string;
  receivedAt: string;
  prefilterPassed?: boolean;
  app: string;
  title?: string;
  titleBig?: string;
  text?: string;
  bigText?: string;
  subText?: string;
  summaryText?: string;
};

export type NotificationQueueStatus =
  | 'not_queued'
  | 'pending'
  | 'processing'
  | 'done'
  | 'error';

export type NotificationProcessSnapshot = {
  running: boolean;
  pending: number;
  processing: number;
  done: number;
  error: number;
  total: number;
  nextPendingIsNotification: boolean;
};

export type NotificationMonitorEntry = {
  id: string;
  app: string;
  preview: string;
  receivedAt: string;
  prefilterPassed: boolean;
  queueStatus: NotificationQueueStatus;
};

export type NotificationMonitorSnapshot = {
  isAndroid: boolean;
  permissionStatus: PermissionStatus;
  capturedTotal: number;
  prefilterPassed: number;
  prefilterIgnored: number;
  lastReceivedAt: string | null;
  queue: NotificationProcessSnapshot;
  recent: NotificationMonitorEntry[];
};

function readCapturedNotifications(): StoredNotification[] {
  try {
    const raw = notificationStorage.getString(CAPTURED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function notificationPreview(n: StoredNotification): string {
  const body =
    n.bigText || n.text || n.subText || n.summaryText || n.titleBig || n.title || '';
  return body.slice(0, 80) || '(empty)';
}

function resolveQueueStatus(
  notificationId: string,
  prefilterPassed: boolean,
): NotificationQueueStatus {
  if (!prefilterPassed) return 'not_queued';
  const item = getAll().find((i) => i.type === 'notification' && i.id === notificationId);
  return item?.status ?? 'not_queued';
}

export function getNotificationProcessSnapshot(): NotificationProcessSnapshot {
  const items = getAll().filter((i) => i.type === 'notification');
  const pending = items.filter((i) => i.status === 'pending').length;
  const processing = items.filter((i) => i.status === 'processing').length;
  const done = items.filter((i) => i.status === 'done').length;
  const error = items.filter((i) => i.status === 'error').length;

  const peek = peekPending();
  const bg = isBackgroundProcessorRunning();
  const nextPendingIsNotification = peek?.type === 'notification';

  const running = processing > 0 || (bg && nextPendingIsNotification);

  return {
    running,
    pending,
    processing,
    done,
    error,
    total: items.length,
    nextPendingIsNotification,
  };
}

export function getNotificationMonitorSnapshot(
  permissionStatus: PermissionStatus,
): NotificationMonitorSnapshot {
  const captured = readCapturedNotifications();
  const prefilterPassed = captured.filter((n) => n.prefilterPassed).length;

  const recent = captured.slice(0, 8).map((n) => ({
    id: n.id,
    app: n.app || 'Unknown',
    preview: notificationPreview(n),
    receivedAt: n.receivedAt,
    prefilterPassed: !!n.prefilterPassed,
    queueStatus: resolveQueueStatus(n.id, !!n.prefilterPassed),
  }));

  return {
    isAndroid: Platform.OS === 'android',
    permissionStatus,
    capturedTotal: captured.length,
    prefilterPassed,
    prefilterIgnored: captured.length - prefilterPassed,
    lastReceivedAt: captured[0]?.receivedAt ?? null,
    queue: getNotificationProcessSnapshot(),
    recent,
  };
}

async function readPermissionStatus(): Promise<PermissionStatus> {
  return readNotificationListenerPermission();
}

export function useNotificationMonitor(pollMs = 1500) {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown');
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<NotificationMonitorSnapshot>(() =>
    getNotificationMonitorSnapshot('unknown'),
  );

  const refresh = useCallback(async () => {
    const status = await readPermissionStatus();
    setPermissionStatus(status);
    setLastCheckedAt(new Date().toISOString());
    setSnapshot(getNotificationMonitorSnapshot(status));
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, pollMs);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh, pollMs]);

  return { snapshot, permissionStatus, lastCheckedAt, refresh };
}

export const QUEUE_STATUS_LABELS: Record<NotificationQueueStatus, string> = {
  not_queued: 'Ignored',
  pending: 'Queued',
  processing: 'Processing',
  done: 'Done',
  error: 'Error',
};

export const QUEUE_STATUS_COLORS: Record<NotificationQueueStatus, string> = {
  not_queued: '#71717a',
  pending: '#f59e0b',
  processing: '#3b82f6',
  done: '#22c55e',
  error: '#ef4444',
};

export const PERMISSION_COLORS: Record<PermissionStatus, string> = {
  authorized: '#22c55e',
  denied: '#ef4444',
  unknown: '#f59e0b',
  unavailable: '#71717a',
};
