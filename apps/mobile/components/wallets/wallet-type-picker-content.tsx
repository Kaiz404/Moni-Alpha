import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { IconAction } from '@/components/ui/icon-action';
import {
  BOTTOM_SHEET_PRIMARY_ACTION_SPACE,
  BottomSheetPrimaryAction,
} from '@/components/ui/bottom-sheet-primary-action';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import {
  WALLET_TYPE_OPTIONS,
  type WalletKind,
} from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type WalletTypePickerContentProps = {
  value: WalletKind;
  onChange: (value: WalletKind) => void;
  onClose: () => void;
};

export function WalletTypePickerContent({
  value,
  onChange,
  onClose,
}: WalletTypePickerContentProps) {
  const tokens = useThemeTokens();

  return (
    <View className="flex-1 px-4">
      <View className="mb-5 flex-row items-center justify-between">
        <Text className="flex-1 pr-3 text-xl font-bold text-foreground">
          Account type
        </Text>
        <IconAction
          accessibilityLabel="Close account type picker"
          icon="close"
          onPress={onClose}
        />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: BOTTOM_SHEET_PRIMARY_ACTION_SPACE,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2">
          {WALLET_TYPE_OPTIONS.map((option) => {
            const selected = option.value === value;
            return (
              <TouchableOpacity
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                activeOpacity={0.82}
                className={`min-h-14 flex-row items-center rounded-2xl px-4 py-3 ${
                  selected ? 'bg-primary-muted' : 'bg-card'
                }`}
                onPress={() => {
                  onChange(option.value);
                }}
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-background-muted">
                  <WalletIcon
                    color={
                      selected ? tokens.primary : tokens.foreground
                    }
                    icon={option.icon}
                    size={19}
                  />
                </View>
                <Text className="ml-3 flex-1 text-base font-semibold text-foreground">
                  {option.label}
                </Text>
                {selected ? (
                  <IconSymbol
                    name="check-circle"
                    size={20}
                    color={tokens.primary}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <BottomSheetPrimaryAction
        horizontalInset={16}
        icon="check"
        label="Use account type"
        onPress={onClose}
      />
    </View>
  );
}
