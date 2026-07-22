import { useState } from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  NotificationSourcePickerContent,
  getNotificationAppIconUri,
  NotificationAppIcon,
  useNotificationSourceData,
  type WalletNotificationLinkValue,
} from '@/components/wallets/notification-source-picker-content';
import {
  SquircleView,
  squircleSmoothing,
} from '@/components/ui/squircle-view';
import { labelForNotificationPackage } from '@/constants/notification-apps';

export type { WalletNotificationLinkValue } from '@/components/wallets/notification-source-picker-content';

type Props = {
  value: WalletNotificationLinkValue;
  onChange: (next: WalletNotificationLinkValue) => void;
  sharedPackageWalletNames?: string[];
};

/** Notification source stays compact until its curated picker is needed. */
export function WalletNotificationLinkSection({
  value,
  onChange,
  sharedPackageWalletNames = [],
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const data = useNotificationSourceData();
  const selectedLabel =
    value.notificationAppLabel ||
    (value.notificationPackage
      ? labelForNotificationPackage(value.notificationPackage)
      : null);

  return (
    <View>
      <TouchableOpacity
        accessibilityLabel="Choose notification source"
        activeOpacity={0.82}
        className="flex-row items-center rounded-2xl px-4 py-3.5"
        onPress={() => setVisible(true)}
      >
        <View className="mr-3">
          <NotificationAppIcon
            iconUri={getNotificationAppIconUri(
              value.notificationPackage,
              data.installed,
            )}
            size={40}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-foreground">
            {selectedLabel ?? 'No app selected'}
          </Text>
          <Text
            className="mt-0.5 text-xs text-muted"
            numberOfLines={1}
          >
            {selectedLabel
              ? 'Tap to change the linked app'
              : 'Choose an installed banking app'}
          </Text>
        </View>
        <Text className="text-sm font-semibold text-primary">
          Change
        </Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <View className="flex-1 justify-end bg-black/40">
          <SquircleView
            className="max-h-[88%] overflow-hidden rounded-[28px] bg-canvas"
            cornerSmoothing={squircleSmoothing.hero}
            style={{ height: Math.round(windowHeight * 0.76) }}
          >
            <View
              className="px-5 pb-4 pt-3"
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            >
              <View className="mb-4 h-1.5 w-10 self-center rounded-full bg-border" />
              <NotificationSourcePickerContent
                {...data}
                value={value}
                onChange={onChange}
                onClose={() => setVisible(false)}
                sharedPackageWalletNames={sharedPackageWalletNames}
              />
            </View>
          </SquircleView>
        </View>
      </Modal>
    </View>
  );
}
