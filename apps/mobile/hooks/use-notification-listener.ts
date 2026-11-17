import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import type { CapturedNotificationStatus } from '@repo/types';
import { onCaptureStatusChanged, withoutAlertImages } from '@/lib/notifications/capture-status';
import {
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
  /** The ledger row an Added, Auto-added or Same payment entry became. */
  transactionId?: string;
  /** A Same payment entry whose other capture still waits in Review. */
  pairedProposalId?: string;
};

/** Entries captured before statuses existed have none. */
type StoredNotification = Omit<CapturedNotification, 'status'> & {
  status?: CapturedNotificationStatus;
};

const STORAGE_KEY = 'captured_notifications';

const notificationStorage = createMMKV({ id: 'moni-notifications' });

/**
 * Null when the stored log can't be read, which is not the same as an empty one: the page says so,
 * and nothing writes over what is there.
 */
function readStoredNotifications(): CapturedNotification[] | null {
  let stored: unknown;
  try {
    const raw = notificationStorage.getString(STORAGE_KEY);
    stored = raw ? JSON.parse(raw) : [];
  } catch {
    return null;
  }
  if (!Array.isArray(stored)) return null;
  return (stored as (StoredNotification | null)[])
    .filter((entry): entry is StoredNotification => typeof entry?.id === 'string')
    .map((entry) => ({ ...withoutAlertImages(entry), status: entry.status ?? 'ignored' }));
}

function writeStoredNotifications(list: CapturedNotification[]): void {
  notificationStorage.set(STORAGE_KEY, JSON.stringify(list));
}

export function useNotificationListener() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown');
  const [lastPermissionCheckAt, setLastPermissionCheckAt] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<CapturedNotification[]>([]);
  const [unreadable, setUnreadable] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);

  const isAndroid = Platform.OS === 'android';

  const refresh = useCallback(() => {
    const stored = readStoredNotifications();
    setNotifications(stored ?? []);
    setUnreadable(stored === null);
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

  const clearAll = useCallback(() => {
    notificationStorage.remove(STORAGE_KEY);
    setNotifications([]);
    setUnreadable(false);
  }, []);

  /** Returns the removed entry so Undo can put it back. */
  const clearOne = useCallback((id: string): CapturedNotification | null => {
    const stored = readStoredNotifications();
    if (!stored) return null;
    const updated = stored.filter((n) => n.id !== id);
    writeStoredNotifications(updated);
    setNotifications(updated);
    return stored.find((n) => n.id === id) ?? null;
  }, []);

  const restoreOne = useCallback((entry: CapturedNotification) => {
    const stored = readStoredNotifications();
    if (!stored || stored.some((n) => n.id === entry.id)) return;
    const updated = [...stored, entry].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    writeStoredNotifications(updated);
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

    const stopListening = onCaptureStatusChanged(refresh);

    return () => {
      sub.remove();
      stopListening();
    };
  }, [checkPermission, refresh]);

  return {
    permissionStatus,
    lastPermissionCheckAt,
    isCheckingPermission,
    notifications,
    unreadable,
    checkPermission,
    refresh,
    clearAll,
    clearOne,
    restoreOne,
    isAndroid,
  };
}
