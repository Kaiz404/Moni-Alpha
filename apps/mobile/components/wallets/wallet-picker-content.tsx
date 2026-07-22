import { Pressable, ScrollView, Text, View } from 'react-native';

import { IconAction } from '@/components/ui/icon-action';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { walletPickerScrollEnabled } from '@/components/wallets/wallet-picker-sheet-height';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

export type WalletPickerItem = {
  id: string;
  name: string;
  currency: string;
  type: string | null;
  icon: string | null;
};

type WalletPickerContentProps = {
  wallets: WalletPickerItem[];
  selectedId?: string | null;
  title?: string;
  subtitle?: string;
  onSelect: (wallet: WalletPickerItem) => void;
  onClose: () => void;
};

/** Shared wallet picker body. Choosing an option changes selection but never dismisses its sheet. */
export function WalletPickerContent({
  wallets,
  selectedId,
  title = 'Choose wallet',
  subtitle = 'Pick the wallet for this transaction.',
  onSelect,
  onClose,
}: WalletPickerContentProps) {
  const tokens = useThemeTokens();

  const row = (wallet: WalletPickerItem) => {
    const selected = wallet.id === selectedId;
    return (
      <Pressable
        key={wallet.id}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className={`mb-2 min-h-14 flex-row items-center rounded-2xl px-4 py-3 active:opacity-85 ${
          selected ? 'bg-primary-muted' : 'bg-card'
        }`}
        onPress={() => onSelect(wallet)}
      >
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-background-muted">
          <WalletIcon
            color={selected ? tokens.primary : tokens.foreground}
            icon={wallet.icon}
            size={20}
            type={wallet.type}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-base font-semibold text-foreground">
            {wallet.name}
          </Text>
          <Text className="mt-0.5 text-xs font-semibold uppercase text-muted">
            {wallet.currency}
          </Text>
        </View>
        {selected ? (
          <IconSymbol
            color={tokens.primary}
            name="check"
            size={20}
          />
        ) : null}
      </Pressable>
    );
  };

  return (
    <View className="flex-1">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-bold text-foreground">
            {title}
          </Text>
          <Text className="mt-1 text-sm leading-5 text-muted">
            {subtitle}
          </Text>
        </View>
        <IconAction
          accessibilityLabel="Close wallet picker"
          icon="close"
          onPress={onClose}
        />
      </View>
      <ScrollView
        className="flex-1"
        scrollEnabled={walletPickerScrollEnabled(wallets.length)}
        bounces={walletPickerScrollEnabled(wallets.length)}
        contentContainerClassName="pb-3"
        showsVerticalScrollIndicator={false}
      >
        {wallets.length === 0 ? (
          <Text className="px-1 text-sm leading-5 text-muted">
            Add another wallet to complete this transfer.
          </Text>
        ) : (
          wallets.map(row)
        )}
      </ScrollView>
    </View>
  );
}
