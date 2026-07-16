import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';

export type WalletPickerItem = { id: string; name: string; currency: string };

type WalletPickerModalProps = {
  visible: boolean;
  title: string;
  wallets: WalletPickerItem[];
  onSelect: (walletId: string) => void;
  onCancel: () => void;
};

export function WalletPickerModal({
  visible,
  title,
  wallets,
  onSelect,
  onCancel,
}: WalletPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-2xl bg-background p-6 pb-10">
          <Text className="mb-4 text-base font-semibold text-foreground">{title}</Text>
          {wallets.length === 0 ? (
            <Text className="mb-4 text-sm text-muted">
              Add another wallet to complete this transfer.
            </Text>
          ) : (
            wallets.map((w) => (
              <TouchableOpacity
                key={w.id}
                className="flex-row items-center border-b border-border py-3"
                onPress={() => onSelect(w.id)}>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">{w.name}</Text>
                  <Text className="text-xs text-muted">{w.currency}</Text>
                </View>
                <IconSymbol name="chevron-right" size={16} color="#9ca3af" />
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity
            className="mt-4 items-center rounded-lg bg-background-muted py-3"
            onPress={onCancel}>
            <Text className="text-sm font-medium text-foreground">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
