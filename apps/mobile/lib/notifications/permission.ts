import { Platform } from 'react-native';

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
    const { default: RNAndroidNotificationListener } = await import(
      'react-native-android-notification-listener'
    );
    const raw = await RNAndroidNotificationListener.getPermissionStatus();
    return normalizeStatus(raw);
  } catch {
    return 'unknown';
  }
}

export function openNotificationListenerSettings(): void {
  if (Platform.OS !== 'android') return;
  void import('react-native-android-notification-listener').then(
    ({ default: RNAndroidNotificationListener }) => {
      RNAndroidNotificationListener.requestPermission();
    },
  );
}
