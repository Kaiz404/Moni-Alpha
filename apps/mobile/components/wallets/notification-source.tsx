import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Image } from 'expo-image';

import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  groupCuratedAppsByRegion,
  resolveInstalledPackageForCurated,
} from '@/constants/notification-apps';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getCachedAppIcon } from '@/lib/notifications/app-icon-cache';
import {
  getCachedInstalledAppsMap,
  isMoniAndroidAppsNativeAvailable,
  preloadInstalledApps,
  type InstalledAppInfo,
} from '@/lib/notifications/installed-apps';
import {
  openNotificationListenerSettings,
  readNotificationListenerPermission,
  type NotificationListenerPermission,
} from '@/lib/notifications/permission';

export type WalletNotificationLinkValue = {
  notificationPackage: string | null;
  notificationAppLabel: string | null;
  notificationAccountHint: string | null;
};

export type InstalledBankApp = {
  packageName: string;
  label: string;
  /** The region label, such as "Malaysia". */
  region: string;
  iconUri: string | null;
};

/** Curated banking apps installed on this phone, or why none can be listed. */
export function useNotificationSourceData() {
  const [installed, setInstalled] = useState<Map<string, InstalledAppInfo>>(
    () => getCachedInstalledAppsMap() ?? new Map(),
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;
    void preloadInstalledApps().then((apps) => {
      if (!cancelled) setInstalled(apps);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = getCachedInstalledAppsMap() ?? installed;
  const loading = Platform.OS === 'android' && !getCachedInstalledAppsMap();

  const apps = useMemo(
    () =>
      groupCuratedAppsByRegion().flatMap((section) =>
        section.apps.flatMap((app): InstalledBankApp[] => {
          const packageName = resolveInstalledPackageForCurated(resolved, app);
          if (!packageName) return [];
          const native = resolved.get(packageName);
          return [
            {
              packageName,
              label: native?.label ?? app.label,
              region: section.title,
              iconUri: native?.iconUri ?? getCachedAppIcon(packageName),
            },
          ];
        }),
      ),
    [resolved],
  );

  const unavailableReason =
    Platform.OS !== 'android'
      ? 'Linking a banking app works on Android only.'
      : !isMoniAndroidAppsNativeAvailable()
        ? 'Listing installed apps needs a native rebuild.'
        : loading
          ? 'Looking for banking apps on this phone…'
          : apps.length === 0
            ? 'No supported banking or e-wallet app is installed on this phone.'
            : null;

  return { installed: resolved, apps, unavailableReason };
}

export function useNotificationSourcePermission() {
  const [permission, setPermission] =
    useState<NotificationListenerPermission>('unknown');

  const refresh = useCallback(async () => {
    setPermission(await readNotificationListenerPermission());
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return {
    notificationAccessEnabled: permission === 'authorized',
    openNotificationSettings: openNotificationListenerSettings,
  };
}

export function getNotificationAppIconUri(
  packageName: string | null,
  installed: Map<string, InstalledAppInfo>,
) {
  if (!packageName) return null;
  return installed.get(packageName)?.iconUri ?? getCachedAppIcon(packageName);
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
      <IconSymbol name="wallet" size={Math.max(16, size - 22)} color={tokens.muted} />
    </View>
  );
}
