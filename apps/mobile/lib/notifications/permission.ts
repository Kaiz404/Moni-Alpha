import { Platform } from 'react-native';

import { openSheet } from '@/lib/sheet/sheet-store';

/** Android notification *listener* access (read other apps' alerts). Not POST_NOTIFICATIONS. */
export type NotificationListenerPermission = 'authorized' | 'denied' | 'unknown' | 'unavailable';

function normalizeStatus(raw: unknown): NotificationListenerPermission {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (value === 'authorized') return 'authorized';
  if (value === 'denied') return 'denied';
  if (value === 'unavailable') return 'unavailable';
  return 'unknown';
}

/**
 * Live read from Android — never cached. Uses NotificationManagerCompat
 * .getEnabledListenerPackages(), same as the native module.
 */
export async function readNotificationListenerPermission(): Promise<NotificationListenerPermission> {
  if (Platform.OS !== 'android') return 'unavailable';

  try {
    const { default: RNAndroidNotificationListener } =
      await import('react-native-android-notification-listener');
    const raw = await RNAndroidNotificationListener.getPermissionStatus();
    return normalizeStatus(raw);
  } catch {
    return 'unknown';
  }
}

/**
 * Google Play wants this in the app right before access is asked for. Both halves must stay true:
 * `isOneTimeCode` holds the first, and run-extraction sends the rest to the Go backend's model.
 */
export const NOTIFICATION_ACCESS_DISCLOSURE =
  'One-time codes never leave this phone, and other payment alerts from the apps you link go to a cloud AI model that reads them.';

export function openNotificationListenerSettings(): void {
  if (Platform.OS !== 'android') return;
  void import('react-native-android-notification-listener').then(
    ({ default: RNAndroidNotificationListener }) => {
      RNAndroidNotificationListener.requestPermission();
    },
  );
}

/** The way to ask for access. Android's settings page says nothing about what Moni does with it. */
export async function askForNotificationAccess(): Promise<void> {
  const confirmed = await openSheet({
    kind: 'confirm',
    title: 'Let Moni read bank alerts?',
    message: NOTIFICATION_ACCESS_DISCLOSURE,
    confirmLabel: 'Open settings',
    cancelLabel: 'Not now',
  });
  if (confirmed) openNotificationListenerSettings();
}
