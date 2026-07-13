import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  groupCuratedAppsByRegion,
  labelForNotificationPackage,
  resolveInstalledPackageForCurated,
  type NotificationAppOption,
} from '@/constants/notification-apps';
import { getCachedAppIcon } from '@/lib/notifications/app-icon-cache';
import {
  getInstalledAppInfo,
  isMoniAndroidAppsNativeAvailable,
  loadInstalledAppsMap,
  type InstalledAppInfo,
} from '@/lib/notifications/installed-apps';
import { listRecentNotificationApps } from '@/lib/notifications/recent-notification-apps';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

const inputClass =
  'rounded-xl border border-border bg-card px-3 py-2.5 text-foreground';

export type WalletNotificationLinkValue = {
  notificationPackage: string | null;
  notificationAppLabel: string | null;
  notificationAccountHint: string | null;
};

type Props = {
  value: WalletNotificationLinkValue;
  onChange: (next: WalletNotificationLinkValue) => void;
  sharedPackageWalletNames?: string[];
};

type AppRow = NotificationAppOption & {
  iconUri: string | null;
};

function resolveAppRow(
  app: NotificationAppOption,
  installed: Map<string, InstalledAppInfo>,
): AppRow {
  const native = installed.get(app.packageName);
  return {
    ...app,
    label: native?.label ?? app.label,
    iconUri:
      native?.iconUri ?? getCachedAppIcon(app.packageName),
  };
}

function AppIcon({ iconUri, size = 20 }: { iconUri: string | null; size?: number }) {
  const tokens = useThemeTokens();
  if (iconUri) {
    return (
      <Image
        source={{ uri: iconUri }}
        style={{ width: size, height: size, borderRadius: size / 4 }}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      className="items-center justify-center rounded-md bg-background-muted"
      style={{ width: size, height: size }}>
      <MaterialIcons name="account-balance-wallet" size={size - 6} color={tokens.muted} />
    </View>
  );
}

function AppPickerRow({
  app,
  selected,
  onPress,
}: {
  app: AppRow;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className={`mb-1.5 flex-row items-center gap-2 rounded-xl border px-3 py-2.5 ${
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card'
      }`}
      onPress={onPress}
      activeOpacity={0.85}>
      <AppIcon iconUri={app.iconUri} size={24} />
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {app.label}
        </Text>
        <Text className="text-[10px] text-muted" numberOfLines={1}>
          {app.packageName}
        </Text>
      </View>
      {selected ? <MaterialIcons name="check-circle" size={18} color="#059669" /> : null}
    </TouchableOpacity>
  );
}

function buildPickerData(installed: Map<string, InstalledAppInfo>): {
  recent: AppRow[];
  curatedSections: {
    region: NotificationAppOption['region'];
    title: string;
    apps: AppRow[];
  }[];
} {
  // Recent notification packages are always eligible — they proved they exist on
  // this device. Enrich with native labels/icons when PackageManager can see them.
  const recent = listRecentNotificationApps().map((r) => {
    const native = installed.get(r.packageName);
    return {
      packageName: r.packageName,
      label: native?.label ?? r.label,
      region: 'MY' as NotificationAppOption['region'],
      iconUri: native?.iconUri ?? r.iconUri ?? getCachedAppIcon(r.packageName),
    };
  });

  const recentPackages = new Set(recent.map((r) => r.packageName));

  const curatedSections = groupCuratedAppsByRegion(recentPackages)
    .map((section) => ({
      region: section.region,
      title: section.title,
      apps: section.apps
        .map((app) => {
          const installedPackage = resolveInstalledPackageForCurated(installed, app);
          if (!installedPackage) return null;
          return resolveAppRow({ ...app, packageName: installedPackage }, installed);
        })
        .filter((app): app is AppRow => app != null),
    }))
    .filter((section) => section.apps.length > 0);

  return { recent, curatedSections };
}

export function WalletNotificationLinkSection({
  value,
  onChange,
  sharedPackageWalletNames = [],
}: Props) {
  const tokens = useThemeTokens();
  const [manualPackage, setManualPackage] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [showCurated, setShowCurated] = useState(true);
  const [installed, setInstalled] = useState<Map<string, InstalledAppInfo>>(new Map());
  const [loadingInstalled, setLoadingInstalled] = useState(Platform.OS === 'android');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      setLoadingInstalled(false);
      return;
    }
    let cancelled = false;
    loadInstalledAppsMap()
      .then((map) => {
        if (!cancelled) setInstalled(map);
      })
      .finally(() => {
        if (!cancelled) setLoadingInstalled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!value.notificationPackage) {
      setSelectedIcon(null);
      return;
    }
    const native = installed.get(value.notificationPackage);
    if (native?.iconUri) {
      setSelectedIcon(native.iconUri);
      return;
    }
    void getInstalledAppInfo(value.notificationPackage).then((info) => {
      setSelectedIcon(info?.iconUri ?? getCachedAppIcon(value.notificationPackage!));
    });
  }, [value.notificationPackage, installed]);

  const pickerData = useMemo(() => buildPickerData(installed), [installed]);

  const selectApp = useCallback(
    (app: Pick<AppRow, 'packageName' | 'label'>) => {
      onChange({
        notificationPackage: app.packageName,
        notificationAppLabel: app.label,
        notificationAccountHint: value.notificationAccountHint,
      });
      setShowManual(false);
    },
    [onChange, value.notificationAccountHint],
  );

  const clearApp = () => {
    onChange({
      notificationPackage: null,
      notificationAppLabel: null,
      notificationAccountHint: value.notificationAccountHint,
    });
  };

  const applyManualPackage = async () => {
    const pkg = manualPackage.trim();
    if (!pkg) return;
    if (Platform.OS === 'android' && isMoniAndroidAppsNativeAvailable()) {
      const info = await getInstalledAppInfo(pkg);
      if (!info) {
        Alert.alert(
          'App not installed',
          'That package is not installed on this device. Install the banking app first, or pick from the list below.',
        );
        return;
      }
      onChange({
        notificationPackage: info.packageName,
        notificationAppLabel: info.label,
        notificationAccountHint: value.notificationAccountHint,
      });
    } else {
      onChange({
        notificationPackage: pkg,
        notificationAppLabel: labelForNotificationPackage(pkg),
        notificationAccountHint: value.notificationAccountHint,
      });
    }
    setShowManual(false);
    setManualPackage('');
  };

  const selectedLabel =
    value.notificationAppLabel ||
    (value.notificationPackage ? labelForNotificationPackage(value.notificationPackage) : null);

  const installedCount = installed.size;
  const hasInstalledFinanceApps =
    pickerData.recent.length > 0 || pickerData.curatedSections.some((s) => s.apps.length > 0);

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        Banking app (Android)
      </Text>
      <Text className="mb-3 text-[11px] leading-4 text-muted">
        Only apps installed on this device are shown. Labels and icons come from Android directly.
      </Text>

      {selectedLabel ? (
        <View className="mb-3 flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
          <AppIcon iconUri={selectedIcon} size={32} />
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold text-foreground">{selectedLabel}</Text>
            {value.notificationPackage ? (
              <Text className="mt-0.5 text-[10px] text-muted" numberOfLines={1}>
                {value.notificationPackage}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={clearApp} activeOpacity={0.85}>
            <Text className="text-xs font-semibold text-primary">Remove</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {sharedPackageWalletNames.length > 0 && value.notificationPackage ? (
        <View className="mb-3 rounded-xl bg-background-muted px-3 py-2">
          <Text className="text-[11px] leading-4 text-muted">
            {selectedLabel} is also linked to {sharedPackageWalletNames.join(', ')}. Moni will use
            notification details to pick the right wallet when needed.
          </Text>
        </View>
      ) : null}

      <Text className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {selectedLabel ? 'Change app' : 'Select app'}
      </Text>

      {loadingInstalled ? (
        <View className="mb-3 items-center py-6">
          <ActivityIndicator color={tokens.primary} />
          <Text className="mt-2 text-xs text-muted">Loading installed apps…</Text>
        </View>
      ) : Platform.OS !== 'android' ? (
        <View className="mb-3 rounded-xl bg-background-muted px-3 py-2">
          <Text className="text-[11px] leading-4 text-muted">
            Notification app linking is only available on Android.
          </Text>
        </View>
      ) : !isMoniAndroidAppsNativeAvailable() ? (
        <View className="mb-3 rounded-xl bg-background-muted px-3 py-2">
          <Text className="text-[11px] leading-4 text-muted">
            Installed-app detection needs a native rebuild. Stop Metro, then run{' '}
            <Text className="font-semibold">pnpm --filter moni android</Text> and reopen the
            app. Until then you can still enter a package name manually if you know it.
          </Text>
        </View>
      ) : !hasInstalledFinanceApps ? (
        <View className="mb-3 rounded-xl bg-background-muted px-3 py-2">
          <Text className="text-[11px] leading-4 text-muted">
            {installedCount === 0
              ? 'Could not read installed apps from Android. Rebuild the development client after the latest native changes, then reopen Moni — or enter a package name manually.'
              : `No matching banking apps installed (${installedCount} apps on device). Install your bank or e-wallet app, then return here — or enter its package name manually.`}
          </Text>
        </View>
      ) : (
        <ScrollView className="max-h-72" nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {pickerData.recent.length > 0 ? (
            <View className="mb-3">
              <Text className="mb-1.5 text-xs font-semibold text-foreground">Recently seen</Text>
              <Text className="mb-2 text-[10px] text-muted">
                Installed apps that sent notifications on this device.
              </Text>
              {pickerData.recent.map((app) => (
                <AppPickerRow
                  key={app.packageName}
                  app={app}
                  selected={value.notificationPackage === app.packageName}
                  onPress={() => selectApp(app)}
                />
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => setShowCurated((v) => !v)}
            className="mb-2 flex-row items-center justify-between"
            activeOpacity={0.85}>
            <Text className="text-xs font-semibold text-foreground">Installed banking apps</Text>
            <MaterialIcons
              name={showCurated ? 'expand-less' : 'expand-more'}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>

          {showCurated
            ? pickerData.curatedSections.map((section) => (
                <View key={section.region} className="mb-3">
                  <Text className="mb-1.5 text-xs font-semibold text-muted">{section.title}</Text>
                  {section.apps.map((app) => (
                    <AppPickerRow
                      key={app.packageName}
                      app={app}
                      selected={value.notificationPackage === app.packageName}
                      onPress={() => selectApp(app)}
                    />
                  ))}
                </View>
              ))
            : null}
        </ScrollView>
      )}

      <TouchableOpacity
        onPress={() => setShowManual((v) => !v)}
        className="mb-2 mt-1 self-start"
        activeOpacity={0.85}>
        <Text className="text-xs font-semibold text-primary">
          {showManual ? 'Hide manual entry' : 'Enter package name manually'}
        </Text>
      </TouchableOpacity>

      {showManual ? (
        <View className="mb-2 flex-row items-center gap-2">
          <TextInput
            className={`flex-1 text-sm ${inputClass}`}
            placeholder="com.bank.app"
            placeholderTextColor="#9CA3AF"
            value={manualPackage}
            onChangeText={setManualPackage}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={() => void applyManualPackage()}
            className="rounded-xl bg-primary px-3 py-2.5"
            activeOpacity={0.85}>
            <Text className="text-xs font-semibold text-primary-foreground">Add</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text className="mb-1.5 mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Account hint (optional)
      </Text>
      <Text className="mb-2 text-[11px] leading-4 text-muted">
        How this account appears in alerts — e.g. Savings, ****4521. Helps when multiple wallets use
        the same app.
      </Text>
      <TextInput
        className={`text-base ${inputClass}`}
        placeholder="Savings, ****4521, …"
        placeholderTextColor="#9CA3AF"
        value={value.notificationAccountHint ?? ''}
        onChangeText={(text) =>
          onChange({
            ...value,
            notificationAccountHint: text.trim() ? text : null,
          })
        }
      />
    </View>
  );
}
