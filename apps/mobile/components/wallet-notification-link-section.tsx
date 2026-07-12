import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import {
  CURATED_NOTIFICATION_APPS,
  labelForNotificationPackage,
  type NotificationAppOption,
} from '@/constants/notification-apps';
import { listRecentNotificationApps } from '@/lib/notifications/recent-notification-apps';
import { chipClass, chipTextClass } from '@/components/ui/chip';

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
  /** Other wallets already linked to the selected package (for info banner). */
  sharedPackageWalletNames?: string[];
};

type AppChoice = NotificationAppOption & { source: 'recent' | 'curated' };

function buildAppChoices(): AppChoice[] {
  const recent = listRecentNotificationApps().map((r) => ({
    packageName: r.packageName,
    label: r.label,
    source: 'recent' as const,
  }));
  const seen = new Set(recent.map((r) => r.packageName));
  const curated = CURATED_NOTIFICATION_APPS.filter((a) => !seen.has(a.packageName)).map(
    (a) => ({ ...a, source: 'curated' as const }),
  );
  return [...recent, ...curated];
}

export function WalletNotificationLinkSection({
  value,
  onChange,
  sharedPackageWalletNames = [],
}: Props) {
  const [manualPackage, setManualPackage] = useState('');
  const [showManual, setShowManual] = useState(false);
  const appChoices = useMemo(() => buildAppChoices(), []);

  const selectApp = (app: NotificationAppOption) => {
    onChange({
      notificationPackage: app.packageName,
      notificationAppLabel: app.label,
      notificationAccountHint: value.notificationAccountHint,
    });
    setShowManual(false);
  };

  const clearApp = () => {
    onChange({
      notificationPackage: null,
      notificationAppLabel: null,
      notificationAccountHint: value.notificationAccountHint,
    });
  };

  const applyManualPackage = () => {
    const pkg = manualPackage.trim();
    if (!pkg) return;
    onChange({
      notificationPackage: pkg,
      notificationAppLabel: labelForNotificationPackage(pkg),
      notificationAccountHint: value.notificationAccountHint,
    });
    setShowManual(false);
    setManualPackage('');
  };

  const selectedLabel =
    value.notificationAppLabel ||
    (value.notificationPackage ? labelForNotificationPackage(value.notificationPackage) : null);

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        Banking app (Android)
      </Text>
      <Text className="mb-3 text-[11px] leading-4 text-muted">
        Link the Android app that sends transaction alerts for this wallet. Notifications from
        unlinked apps are ignored.
      </Text>

      {selectedLabel ? (
        <View className="mb-3 rounded-xl border border-border bg-card px-3 py-2.5">
          <Text className="text-sm font-semibold text-foreground">{selectedLabel}</Text>
          {value.notificationPackage ? (
            <Text className="mt-0.5 text-[10px] text-muted" numberOfLines={1}>
              {value.notificationPackage}
            </Text>
          ) : null}
          <TouchableOpacity onPress={clearApp} className="mt-2 self-start" activeOpacity={0.85}>
            <Text className="text-xs font-semibold text-primary">Remove link</Text>
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
      <View className="mb-2 flex-row flex-wrap gap-1.5">
        {appChoices.map((app) => {
          const selected = value.notificationPackage === app.packageName;
          return (
            <TouchableOpacity
              key={`${app.source}-${app.packageName}`}
              className={chipClass(selected)}
              onPress={() => selectApp(app)}
              activeOpacity={0.85}>
              <Text className={`text-xs ${chipTextClass(selected)}`} numberOfLines={1}>
                {app.source === 'recent' ? '• ' : ''}
                {app.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={() => setShowManual((v) => !v)}
        className="mb-2 self-start"
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
            onPress={applyManualPackage}
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
