import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconAction } from '@/components/ui/icon-action';
import { PrimaryButton } from '@/components/ui/primary-button';

export type WalletPickerItem = {
  id: string;
  name: string;
  currency: string;
};

type WalletPickerModalProps = {
  visible: boolean;
  title: string;
  wallets: WalletPickerItem[];
  onSelect: (walletId: string) => void;
  onCancel: () => void;
};

/** Native-feeling selection sheet for choosing a transfer wallet. */
export function WalletPickerModal({
  visible,
  title,
  wallets,
  onSelect,
  onCancel,
}: WalletPickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-end bg-black/40">
        <SafeAreaView
          edges={['bottom']}
          className="rounded-t-[28px] border border-border bg-canvas px-5 pb-4 pt-3"
        >
          <View className="mb-4 h-1.5 w-10 self-center rounded-full bg-border" />
          <View className="mb-4 flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-[22px] font-bold text-foreground">
              {title}
            </Text>
            <IconAction
              accessibilityLabel="Close wallet picker"
              icon="close"
              onPress={onCancel}
              size={20}
            />
          </View>
          {wallets.length === 0 ? (
            <Text className="mb-5 text-sm leading-5 text-muted">
              Add another wallet to complete this transfer.
            </Text>
          ) : (
            wallets.map((wallet) => (
              <TouchableOpacity
                key={wallet.id}
                className="mb-2 min-h-14 flex-row items-center rounded-2xl border border-border bg-card px-4 py-3"
                onPress={() => onSelect(wallet.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={['Choose', wallet.name].join(' ')}
              >
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">
                    {wallet.name}
                  </Text>
                  <Text className="mt-0.5 text-xs font-semibold text-muted">
                    {wallet.currency.toUpperCase()}
                  </Text>
                </View>
                <IconAction
                  accessibilityLabel={['Choose', wallet.name].join(' ')}
                  icon="chevron-right"
                  onPress={() => onSelect(wallet.id)}
                  size={16}
                />
              </TouchableOpacity>
            ))
          )}
          <PrimaryButton
            label="Cancel"
            variant="secondary"
            className="mt-3"
            onPress={onCancel}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
