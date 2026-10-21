import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import type { CapturedNotificationStatus } from '@repo/types';
import {
  openNotificationListenerSettings,
  readNotificationListenerPermission,
  type NotificationListenerPermission,
} from '@/lib/notifications/permission';

export type PermissionStatus = NotificationListenerPermission;

export type CapturedNotification = {
  id: string;
  receivedAt: string;
  prefilterPassed?: boolean;
  packageLinked?: boolean;
  packageName?: string;
  time: string;
  app: string;
  title: string;
  titleBig: string;
  text: string;
  subText: string;
  summaryText: string;
  bigText: string;
  extraInfoText: string;
  groupedMessages: Array<{ title: string; text: string }>;
  status: CapturedNotificationStatus;
};

/** Entries captured before statuses existed have none. */
type StoredNotification = Omit<CapturedNotification, 'status'> & {
  status?: CapturedNotificationStatus;
};

const STORAGE_KEY = 'captured_notifications';

const notificationStorage = createMMKV({ id: 'moni-notifications' });

function readStoredNotifications(): CapturedNotification[] {
  try {
    const raw = notificationStorage.getString(STORAGE_KEY);
    const stored: StoredNotification[] = raw ? JSON.parse(raw) : [];
    return stored.map((entry) => ({ ...entry, status: entry.status ?? 'ignored' }));
  } catch {
    return [];
  }
}

export function useNotificationListener() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown');
  const [lastPermissionCheckAt, setLastPermissionCheckAt] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<CapturedNotification[]>([]);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);

  const isAndroid = Platform.OS === 'android';

  const refresh = useCallback(() => {
    setNotifications(readStoredNotifications());
  }, []);

  const checkPermission = useCallback(async () => {
    if (!isAndroid) {
      setPermissionStatus('unavailable');
      setLastPermissionCheckAt(new Date().toISOString());
      return;
    }

    setIsCheckingPermission(true);
    try {
      const status = await readNotificationListenerPermission();
      setPermissionStatus(status);
      setLastPermissionCheckAt(new Date().toISOString());
    } finally {
      setIsCheckingPermission(false);
    }
  }, [isAndroid]);

  const requestPermission = useCallback(() => {
    openNotificationListenerSettings();
  }, []);

  const clearAll = useCallback(() => {
    notificationStorage.remove(STORAGE_KEY);
    setNotifications([]);
  }, []);

  const clearOne = useCallback((id: string) => {
    const updated = readStoredNotifications().filter((n) => n.id !== id);
    notificationStorage.set(STORAGE_KEY, JSON.stringify(updated));
    setNotifications(updated);
  }, []);

  useEffect(() => {
    checkPermission();
    refresh();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkPermission();
        refresh();
      }
    });

    return () => sub.remove();
  }, [checkPermission, refresh]);

  return {
    permissionStatus,
    lastPermissionCheckAt,
    isCheckingPermission,
    notifications,
    checkPermission,
    requestPermission,
    refresh,
    clearAll,
    clearOne,
    isAndroid,
  };
}
