import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

export type PermissionStatus = 'authorized' | 'denied' | 'unknown' | 'unavailable';

export type CapturedNotification = {
  id: string;
  receivedAt: string;
  prefilterPassed?: boolean;
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
};

const STORAGE_KEY = 'captured_notifications';

const notificationStorage = createMMKV({ id: 'moni-notifications' });

function readStoredNotifications(): CapturedNotification[] {
  try {
    const raw = notificationStorage.getString(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useNotificationListener() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown');
  const [notifications, setNotifications] = useState<CapturedNotification[]>([]);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);

  const isAndroid = Platform.OS === 'android';

  const refresh = useCallback(() => {
    setNotifications(readStoredNotifications());
  }, []);

  const checkPermission = useCallback(async () => {
    if (!isAndroid) {
      setPermissionStatus('unavailable');
      return;
    }
    setIsCheckingPermission(true);
    try {
      const { default: RNAndroidNotificationListener } = await import(
        'react-native-android-notification-listener'
      );
      const status = await RNAndroidNotificationListener.getPermissionStatus();
      setPermissionStatus(status as PermissionStatus);
    } catch {
      setPermissionStatus('unknown');
    } finally {
      setIsCheckingPermission(false);
    }
  }, [isAndroid]);

  const requestPermission = useCallback(async () => {
    if (!isAndroid) return;
    try {
      const { default: RNAndroidNotificationListener } = await import(
        'react-native-android-notification-listener'
      );
      RNAndroidNotificationListener.requestPermission();
    } catch {
      // Module unavailable in this environment
    }
  }, [isAndroid]);

  const clearAll = useCallback(() => {
    notificationStorage.remove(STORAGE_KEY);
    setNotifications([]);
  }, []);

  const clearOne = useCallback((id: string) => {
    const updated = readStoredNotifications().filter((n) => n.id !== id);
    notificationStorage.set(STORAGE_KEY, JSON.stringify(updated));
    setNotifications(updated);
  }, []);

  // Check permission on mount and whenever the app comes back to foreground
  // (user may have just enabled it in Settings)
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
