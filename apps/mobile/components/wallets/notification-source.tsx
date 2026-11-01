import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Image } from 'expo-image';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getCachedAppIcon } from '@/lib/notifications/app-icon-cache';
import {
  canListEveryApp,
  getCachedInstalledAppsMap,
  getInstalledAppInfo,
  isMoniAndroidAppsNativeAvailable,
  refreshInstalledApps,
  type InstalledAppInfo,
} from '@/lib/notifications/installed-apps';
import {
  askForNotificationAccess,
  readNotificationListenerPermission,
  type NotificationListenerPermission,
} from '@/lib/notifications/permission';

export type AppListing =
  | { kind: 'not_android' }
  | { kind: 'needs_rebuild' }
  | { kind: 'loading' }
  /** `everyApp` is false on a build from before the launcher query. */
  | { kind: 'listed'; apps: ReadonlyMap<string, InstalledAppInfo>; everyApp: boolean };

/** The apps on this phone: the last listing at once, and a fresh one as soon as it arrives. */
export function useInstalledApps(): AppListing {
  const [apps, setApps] = useState(getCachedInstalledAppsMap);

  useEffect(() => {
    let cancelled = false;
    void refreshInstalledApps().then((next) => {
      if (!cancelled) setApps(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (Platform.OS !== 'android') return { kind: 'not_android' };
  if (!isMoniAndroidAppsNativeAvailable()) return { kind: 'needs_rebuild' };
  if (!apps) return { kind: 'loading' };
  return { kind: 'listed', apps, everyApp: canListEveryApp() };
}

/** The app's launcher icon: what's kept if anything, otherwise asked of the phone by name. */
export function useAppIcon(packageName: string | null): string | null {
  const [icon, setIcon] = useState(() => (packageName ? getCachedAppIcon(packageName) : null));

  useEffect(() => {
    const cached = packageName ? getCachedAppIcon(packageName) : null;
    setIcon(cached);
    if (!packageName || cached) return;
    let cancelled = false;
    void getInstalledAppInfo(packageName).then((app) => {
      if (!cancelled) setIcon(app?.iconUri ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [packageName]);

  return icon;
}

export function useNotificationSourcePermission() {
  const [permission, setPermission] =
    useState<NotificationListenerPermission>('unknown');

  const refresh = useCallback(async () => {
    setPermission(await readNotificationListenerPermission());
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') void refresh();
      },
    );
    return () => subscription.remove();
  }, [refresh]);

  return {
    notificationAccessEnabled: permission === 'authorized',
    openNotificationSettings: askForNotificationAccess,
  };
}

export function NotificationAppIcon({
  iconUri,
  size = 28,
}: {
  iconUri: string | null;
  size?: number;
}) {
  const tokens = useThemeTokens();
  if (iconUri) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        contentFit="cover"
        source={{ uri: iconUri }}
        style={{ borderRadius: size / 4, height: size, width: size }}
      />
    );
  }
  return (
    <View
      className="items-center justify-center rounded-full bg-sand"
      style={{ height: size, width: size }}
    >
      <IconSymbol
        name="wallet"
        size={Math.max(16, size - 22)}
        color={tokens.muted}
      />
    </View>
  );
}
