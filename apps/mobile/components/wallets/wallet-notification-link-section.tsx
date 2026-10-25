import { Platform, View } from 'react-native';

import { FormField } from '@/components/ui/form-field';
import { PickerField } from '@/components/ui/picker-field';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useNotificationSourcePermission } from '@/components/wallets/notification-source';
import { labelForNotificationPackage } from '@/constants/notification-apps';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { openSheet } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';
import type { WalletAlertLink } from '@/lib/wallets/wallet-link';

type Props = {
  value: WalletAlertLink;
  onChange: (next: WalletAlertLink) => void;
  sharedPackageWalletNames?: string[];
};

/** "Alerts from": the banking app whose notifications become this wallet's captures. */
export function WalletNotificationLinkSection({
  value,
  onChange,
  sharedPackageWalletNames = [],
}: Props) {
  const tokens = useThemeTokens();
  const permission = useNotificationSourcePermission();
  const selectedLabel =
    value.notificationAppLabel ||
    (value.notificationPackage
      ? labelForNotificationPackage(value.notificationPackage)
      : null);

  // iOS has no notification access, so the sheet itself explains that linking is Android-only.
  const needsAccess =
    Platform.OS === 'android' &&
    !permission.notificationAccessEnabled;
  const accessRow = needsAccess ? (
    <Press
      testID={tid('wallet', 'enable-notification-access')}
      accessibilityLabel="Let Moni read bank alerts"
      pressedClassName="bg-hairline"
      className="flex-row items-center gap-3 rounded-field bg-sand px-3.5 py-3"
      onPress={permission.openNotificationSettings}
    >
      <IconSymbol
        name="bell-outline"
        size={22}
        color={tokens.foreground}
      />
      <View className="min-w-0 flex-1">
        <Text className="text-base font-display-semibold text-foreground">
          Let Moni read bank alerts
        </Text>
        <Text className="text-[13px] leading-[18px] text-muted">
          Turn on notification access before linking an app.
        </Text>
      </View>
    </Press>
  ) : null;

  if (needsAccess && !value.notificationPackage) return accessRow;

  const pickApp = async () => {
    const pick = await openSheet({
      kind: 'notificationApp',
      selected: value.notificationPackage,
    });
    if (!pick) return;
    onChange({
      notificationPackage: pick.app?.packageName ?? null,
      notificationAppLabel: pick.app?.label ?? null,
      notificationAccountHint: pick.app
        ? value.notificationAccountHint
        : null,
    });
  };

  return (
    <View className="gap-2">
      {accessRow}
      <PickerField
        testID={tid('wallet', 'alerts-from')}
        label="Alerts from"
        value={selectedLabel ?? "Don't link"}
        onPress={() => void pickApp()}
      />
      {value.notificationPackage &&
      sharedPackageWalletNames.length > 0 ? (
        <FormField
          testID={tid('wallet', 'account-hint')}
          label="Account hint"
          hint={`${selectedLabel ?? 'This app'} also sends alerts for ${sharedPackageWalletNames.join(', ')}. A hint such as Savings or ****4521 tells Moni which wallet an alert is for.`}
          autoCapitalize="words"
          placeholder="Savings or ****4521"
          value={value.notificationAccountHint ?? ''}
          onChangeText={(hint) =>
            onChange({
              ...value,
              notificationAccountHint: hint.trim() ? hint : null,
            })
          }
        />
      ) : null}
    </View>
  );
}
