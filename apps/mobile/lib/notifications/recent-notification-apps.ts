import { createMMKV } from 'react-native-mmkv';
import { resolveNotificationPackageName } from '@/lib/notifications/notification-package';
import { labelForNotificationPackage } from '@/constants/notification-apps';
import { getCachedAppIcon } from '@/lib/notifications/app-icon-cache';

const notificationStorage = createMMKV({ id: 'moni-notifications' });
const ALL_NOTIFICATIONS_KEY = 'captured_notifications';

export type RecentNotificationApp = {
  packageName: string;
  label: string;
  lastSeenAt: string;
  iconUri: string | null;
};

/** Apps seen in captured notifications (deduped, most recent first). */
export function listRecentNotificationApps(limit = 20): RecentNotificationApp[] {
  try {
    const raw = notificationStorage.getString(ALL_NOTIFICATIONS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Array<{
      app?: string;
      packageName?: string;
      receivedAt?: string;
      icon?: string;
    }>;
    if (!Array.isArray(list)) return [];

    const byPackage = new Map<string, RecentNotificationApp>();
    for (const item of list) {
      const packageName = resolveNotificationPackageName(item);
      if (!packageName || packageName === 'unknown') continue;
      const existing = byPackage.get(packageName);
      const receivedAt = item.receivedAt ?? '';
      const iconUri =
        (item.icon?.startsWith('data:image') ? item.icon : null) ?? getCachedAppIcon(packageName);
      if (!existing || receivedAt > existing.lastSeenAt) {
        byPackage.set(packageName, {
          packageName,
          label: labelForNotificationPackage(packageName),
          lastSeenAt: receivedAt,
          iconUri,
        });
      } else if (!existing.iconUri && iconUri) {
        existing.iconUri = iconUri;
      }
    }

    return [...byPackage.values()]
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, limit);
  } catch {
    return [];
  }
}
