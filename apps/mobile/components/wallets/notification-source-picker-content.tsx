import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import {
  groupCuratedAppsByRegion,
  resolveInstalledPackageForCurated,
  type NotificationAppOption,
} from '@/constants/notification-apps';
import { IconAction } from '@/components/ui/icon-action';
import { IconSymbol } from '@/components/ui/icon-symbol';
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

type AppRow = NotificationAppOption & { iconUri: string | null };

const accountHintTransition = LinearTransition.duration(180);

export function useNotificationSourceData(
  notificationAccessEnabled = true,
) {
  const cachedInstalled = getCachedInstalledAppsMap();
  const [installed, setInstalled] = useState<
    Map<string, InstalledAppInfo>
  >(() => cachedInstalled ?? new Map());

  useEffect(() => {
    if (Platform.OS !== 'android' || !notificationAccessEnabled)
      return;

    let cancelled = false;
    void preloadInstalledApps().then((apps) => {
      if (!cancelled) setInstalled(apps);
    });
    return () => {
      cancelled = true;
    };
  }, [notificationAccessEnabled]);

  const resolvedInstalled = getCachedInstalledAppsMap() ?? installed;
  const loadingInstalled =
    notificationAccessEnabled &&
    Platform.OS === 'android' &&
    !getCachedInstalledAppsMap();

  const curatedSections = useMemo(
    () =>
      groupCuratedAppsByRegion()
        .map((section) => ({
          ...section,
          apps: section.apps
            .map((app) => {
              const packageName = resolveInstalledPackageForCurated(
                resolvedInstalled,
                app,
              );
              if (!packageName) return null;
              const native = resolvedInstalled.get(packageName);
              return {
                ...app,
                packageName,
                label: native?.label ?? app.label,
                iconUri:
                  native?.iconUri ?? getCachedAppIcon(packageName),
              } satisfies AppRow;
            })
            .filter((app): app is AppRow => app != null),
        }))
        .filter((section) => section.apps.length > 0),
    [resolvedInstalled],
  );

  return {
    installed: resolvedInstalled,
    loadingInstalled,
    curatedSections,
  };
}

export function useNotificationSourcePermission() {
  const [permission, setPermission] =
    useState<NotificationListenerPermission>('unknown');

  const refreshPermission = useCallback(async () => {
    setPermission(await readNotificationListenerPermission());
  }, []);

  useEffect(() => {
    void refreshPermission();
    const subscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') void refreshPermission();
      },
    );
    return () => subscription.remove();
  }, [refreshPermission]);

  return {
    notificationAccessEnabled: permission === 'authorized',
    openNotificationSettings: openNotificationListenerSettings,
  };
}

export function NotificationAccessRequired({
  onPress,
}: {
  onPress: () => void;
}) {
  const tokens = useThemeTokens();

  return (
    <TouchableOpacity
      accessibilityLabel="Enable notification access"
      activeOpacity={0.82}
      className="flex-row items-center rounded-2xl px-4 py-3.5"
      onPress={onPress}
    >
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <IconSymbol
          name="bell-outline"
          size={22}
          color={tokens.primary}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-foreground">
          Enable notification access
        </Text>
        <Text className="mt-0.5 text-xs leading-4 text-muted">
          Allow Moni to read banking alerts before linking an app.
        </Text>
      </View>
      <Text className="ml-3 text-sm font-semibold text-primary">
        Enable
      </Text>
    </TouchableOpacity>
  );
}

export function getNotificationAppIconUri(
  packageName: string | null,
  installed: Map<string, InstalledAppInfo>,
) {
  if (!packageName) return null;
  return (
    installed.get(packageName)?.iconUri ??
    getCachedAppIcon(packageName)
  );
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
        style={{
          borderRadius: size / 4,
          height: size,
          width: size,
        }}
      />
    );
  }
  return (
    <View
      className="items-center justify-center rounded-md bg-background-muted"
      style={{ height: size, width: size }}
    >
      <IconSymbol
        name="wallet"
        size={Math.max(16, size - 12)}
        color={tokens.muted}
      />
    </View>
  );
}

type NotificationSourcePickerContentProps = ReturnType<
  typeof useNotificationSourceData
> & {
  value: WalletNotificationLinkValue;
  onChange: (next: WalletNotificationLinkValue) => void;
  onClose: () => void;
  sharedPackageWalletNames: string[];
};

export function NotificationSourcePickerContent({
  value,
  onChange,
  onClose,
  sharedPackageWalletNames,
  installed,
  loadingInstalled,
  curatedSections,
}: NotificationSourcePickerContentProps) {
  const tokens = useThemeTokens();
  const selectApp = useCallback(
    (app: AppRow) => {
      onChange({
        notificationPackage: app.packageName,
        notificationAppLabel: app.label,
        notificationAccountHint: value.notificationAccountHint,
      });
    },
    [onChange, value.notificationAccountHint],
  );

  const clearApp = useCallback(() => {
    onChange({
      notificationPackage: null,
      notificationAppLabel: null,
      notificationAccountHint: value.notificationAccountHint,
    });
  }, [onChange, value.notificationAccountHint]);

  return (
    <View className="flex-1">
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-bold text-foreground">
            Notification source
          </Text>
        </View>
        <IconAction
          accessibilityLabel="Close notification source picker"
          icon="close"
          onPress={onClose}
        />
      </View>

      <Text className="mb-2 text-sm font-semibold text-foreground">
        Installed curated apps
      </Text>
      {loadingInstalled ? (
        <View className="items-center py-10">
          <ActivityIndicator color={tokens.primary} />
          <Text className="mt-2 text-xs text-muted">
            Loading installed apps…
          </Text>
        </View>
      ) : Platform.OS !== 'android' ? (
        <Text className="rounded-xl bg-background-muted px-3 py-3 text-xs leading-4 text-muted">
          Notification app linking is available on Android.
        </Text>
      ) : !isMoniAndroidAppsNativeAvailable() ? (
        <Text className="rounded-xl bg-background-muted px-3 py-3 text-xs leading-4 text-muted">
          Installed-app detection needs a native rebuild before apps
          can be listed.
        </Text>
      ) : curatedSections.length === 0 ? (
        <Text className="rounded-xl bg-background-muted px-3 py-3 text-xs leading-4 text-muted">
          No supported banking or e-wallet apps are installed on this
          device.
        </Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {curatedSections.map((section) => (
            <Animated.View
              key={section.region}
              layout={accountHintTransition}
              className="mb-4"
            >
              <Text className="mb-2 text-xs font-semibold text-muted">
                {section.title}
              </Text>
              {section.apps.map((app) => {
                const selected =
                  value.notificationPackage === app.packageName;
                return (
                  <Animated.View
                    key={app.packageName}
                    layout={accountHintTransition}
                    className={`mb-1.5 rounded-xl ${
                      selected ? 'bg-primary/10' : 'bg-card'
                    }`}
                  >
                    <TouchableOpacity
                      accessibilityLabel={
                        selected
                          ? `Remove ${app.label} from this wallet`
                          : `Link ${app.label} to this wallet`
                      }
                      activeOpacity={0.82}
                      className="flex-row items-center px-3 py-2.5"
                      onPress={() =>
                        selected ? clearApp() : selectApp(app)
                      }
                    >
                      <NotificationAppIcon iconUri={app.iconUri} />
                      <View className="ml-3 flex-1">
                        <Text className="text-sm font-medium text-foreground">
                          {app.label}
                        </Text>
                      </View>
                      {selected ? (
                        <IconSymbol
                          name="check-circle"
                          size={19}
                          color={tokens.success}
                        />
                      ) : null}
                    </TouchableOpacity>
                    {selected &&
                    sharedPackageWalletNames.length > 0 ? (
                      <Animated.View
                        key={`${app.packageName}-account-hint`}
                        entering={FadeIn.duration(180)}
                        exiting={FadeOut.duration(120)}
                        layout={accountHintTransition}
                        className="border-t border-primary/15 px-3 pb-3 pt-2"
                      >
                        <Text className="mb-2 text-xs leading-4 text-muted">
                          Also linked to “
                          {sharedPackageWalletNames.join(', ')}”. Add
                          a hint so Moni can route notification
                          proposals to the right wallet.
                        </Text>
                        <TextInput
                          autoCapitalize="words"
                          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
                          onChangeText={(notificationAccountHint) =>
                            onChange({
                              ...value,
                              notificationAccountHint:
                                notificationAccountHint.trim()
                                  ? notificationAccountHint
                                  : null,
                            })
                          }
                          placeholder="Account hint, e.g. Savings or ****4521"
                          placeholderTextColor={tokens.muted}
                          value={value.notificationAccountHint ?? ''}
                        />
                      </Animated.View>
                    ) : null}
                  </Animated.View>
                );
              })}
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
