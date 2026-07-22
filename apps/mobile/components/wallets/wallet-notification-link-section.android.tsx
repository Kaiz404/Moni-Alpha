import { useCallback, useRef, useState } from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Column,
  Host,
  ModalBottomSheet,
  RNHostView,
} from '@expo/ui/jetpack-compose';
import type { ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import {
  height,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import {
  NotificationAccessRequired,
  NotificationSourcePickerContent,
  getNotificationAppIconUri,
  NotificationAppIcon,
  useNotificationSourceData,
  useNotificationSourcePermission,
  type WalletNotificationLinkValue,
} from '@/components/wallets/notification-source-picker-content';
import { labelForNotificationPackage } from '@/constants/notification-apps';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

export type { WalletNotificationLinkValue } from '@/components/wallets/notification-source-picker-content';

type Props = {
  value: WalletNotificationLinkValue;
  onChange: (next: WalletNotificationLinkValue) => void;
  sharedPackageWalletNames?: string[];
};

export function WalletNotificationLinkSection({
  value,
  onChange,
  sharedPackageWalletNames = [],
}: Props) {
  const tokens = useThemeTokens();
  const { height: windowHeight } = useWindowDimensions();
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  const [visible, setVisible] = useState(false);
  const permission = useNotificationSourcePermission();
  const data = useNotificationSourceData(
    permission.notificationAccessEnabled,
  );
  const selectedLabel =
    value.notificationAppLabel ||
    (value.notificationPackage
      ? labelForNotificationPackage(value.notificationPackage)
      : null);

  const dismiss = useCallback(async () => {
    await sheetRef.current?.hide();
    setVisible(false);
  }, []);

  return (
    <View>
      {permission.notificationAccessEnabled ? (
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
          </View>
          <Text className="text-sm font-semibold text-primary">
            Change
          </Text>
        </TouchableOpacity>
      ) : (
        <NotificationAccessRequired
          onPress={permission.openNotificationSettings}
        />
      )}

      <Modal
        animationType="fade"
        onRequestClose={dismiss}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        {visible ? (
          <Host
            matchContents
            style={{ flex: 1 }}
          >
            <ModalBottomSheet
              containerColor={tokens.canvas}
              contentColor={tokens.foreground}
              onDismissRequest={dismiss}
              ref={sheetRef}
              skipPartiallyExpanded
            >
              <Column
                modifiers={[
                  height(Math.round(windowHeight * 0.76)),
                  padding(20, 12, 20, 20),
                ]}
              >
                <RNHostView modifiers={[weight(1)]}>
                  <NotificationSourcePickerContent
                    {...data}
                    value={value}
                    onChange={onChange}
                    onClose={() => void dismiss()}
                    sharedPackageWalletNames={
                      sharedPackageWalletNames
                    }
                  />
                </RNHostView>
              </Column>
            </ModalBottomSheet>
          </Host>
        ) : null}
      </Modal>
    </View>
  );
}
